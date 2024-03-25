var express = require('express');
var router = express.Router();
const sharp = require('sharp'); // Import the sharp library
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');
const sellerHelpers = require('../helpers/seller-helpers')

const verifyLogin = (req, res, next) => {
  if (req.session.seller) {
    next()
  } else {
    res.redirect('/seller/sellerlogin')
  }
}

router.get('/', async function (req, res, next) {
  try {
    let seller = req.session.seller;
  
    // console.log(seller);
    if (seller) {
      const sellerId = seller._id;
      // console.log("sellerId",sellerId);
      const totalSales = await sellerHelpers.getTotalSales(sellerId);
      const totalOrders = await sellerHelpers.getTotalOrders(sellerId);
      const totalAmount = await sellerHelpers.getTotalAmount(sellerId);
      res.render('seller/view-products', { seller: true, seller, totalSales, totalOrders, totalAmount  });
    } else {
      res.redirect('/seller/sellerlogin'); // Redirect to the seller login page if seller is not logged in
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send("Internal Server Error");
  }
});


router.get('/sellerlogin', (req, res) => {
  if (req.session.seller) {
    res.redirect('/seller')
  } else {
    res.render('seller/sellerlogin', { 'loginErr': req.session.sellerLoginErr, seller: true })
    req.session.sellerLoginErr = false
  }
})

router.post('/sellerlogin', (req, res) => {
  sellerHelpers.sellerLogin(req.body).then((response) => {
    if (response.status) {
      req.session.seller = response.seller;
      req.session.seller.loggedIn = true;
      res.redirect('/seller'); // Redirect to the seller dashboard upon successful login
    } else {
      req.session.sellerLoginErr = "Please Enter Valid Username or Password";
      res.redirect('/seller/sellerlogin'); // Redirect back to the seller login page if login fails
    }
  }).catch(err => {
    console.error("Error occurred during seller login:", err);
    res.status(500).send("Internal Server Error");
  });
});



router.get('/sellersignup', async (req, res) => {
  try {
    const States = await sellerHelpers.getStates();
    const DistrictsByState = await sellerHelpers.getDistrictsByState();
    // console.log(States)
    res.render('seller/sellersignup', { States, DistrictsByState, seller: true });
  } catch (error) {
    console.error("Error fetching location:", error);
    // Handle the error appropriately, e.g., render an error page
    res.render('error', { error: "Failed to fetch location data" });
  }
});



router.post('/sellersignup', (req, res) => {
  sellerHelpers.sellerSignup(req.body).then((response) => {
    req.session.seller = response;
    req.session.seller.loggedIn = true;
    res.redirect('/seller');
  });
});

router.get('/sellerlogout', (req, res) => {
  req.session.seller = null
  res.redirect('/seller/sellerlogin')
})

router.get('/add-product', verifyLogin, async function (req, res, next) {
  const vehicleNames = await productHelper.getAllVehicleNames();
  res.render('seller/add-product', { seller: true, seller: req.session.seller, vehicleNames });
});

router.post('/add-product', async (req, res) => {
  try {
    const id = await new Promise((resolve) => {
      productHelper.addProduct(req.body, (id) => {
        resolve(id);
      });
    });

    // Process front image
    if (req.files && req.files.frontImage) {
      const frontImage = req.files.frontImage;
      await sharp(frontImage.data)
        .resize(800, 600) // Resize front image to 800x600 pixels
        .toFile(`./public/product-images/${id}-front.jpg`);
    } else {
      console.log("No front image uploaded or req.files.frontImage is undefined");
      return res.render("seller/add-product", { error: 'No front image uploaded.' });
    }
    // Process back image
    if (req.files && req.files.backImage) {
      const backImage = req.files.backImage;
      await sharp(backImage.data)
        .resize(800, 600) // Resize back image to 800x600 pixels
        .toFile(`./public/product-images/${id}-back.jpg`);
    } else {
      console.log("No back image uploaded or req.files.backImage is undefined");
      return res.render("seller/add-product", { error: 'No back image uploaded.' });
    }

    res.redirect("/seller/add-product"); // Redirect to the add-product page
  } catch (error) {
    console.error("Error processing images", error);
    res.render("seller/add-product", { error: 'Error processing images.' });
  }
});



router.get('/delete-product/:_id', verifyLogin, (req, res) => {
  let productId = req.params._id.trim(); // Trim extra spaces
  productHelper.deleteProduct(productId).then((response) => {
    res.redirect('/seller');
  });
});

// Router handler to render the edit-product page
router.get('/edit-product/:_id', verifyLogin, async (req, res) => {
  const productId = req.params._id;
  
  // Fetch the product data using getProductById function
  productHelper.getProductByIdSeller(productId, (product) => {
    if (product) {
      res.render('seller/edit-product', { product, seller: true });
    } else {
      res.status(404).send('Product not found');
    }
  });
});


router.post('/edit-product/:_id', (req, res) => {
  let id = req.params._id;

  if (req.files && req.files.Image) {
    let image = req.files.Image;
    image.mv('./public/product-images/' + id + '.jpg', (error) => {
      if (error) {
        return res.status(500).send(error.message);
      }

      // Image moved successfully, now update the product
      productHelper.updateProduct(id, req.body, (success) => {
        if (success) {
          res.redirect('/seller');
        } else {
          res.status(500).send('Error updating product.');
        }
      });
    });
  } else {
    // No image uploaded, just update the product
    productHelper.updateProduct(id, req.body, (success) => {
      if (success) {
        res.redirect('/seller');
      } else {
        res.status(500).send('Error updating product.');
      }
    });
  }
});



router.get('/sellerorders', verifyLogin, async (req, res) => {
  try {
    let sellerOrder = await sellerHelpers.getSellerOrders(req.session.seller._id);

    sellerOrder.reverse();

    res.render('seller/sellerorders', { seller: req.session.seller, sellerOrder });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Define the route to handle POST requests to /change-order-status
router.post('/change-order-status', verifyLogin, async (req, res) => {
  try {
    const { orderId, status } = req.body;
    console.log("body", req.body)
    const sellerName = req.session.seller.sname// Assuming sellerName is available in session
    console.log("sellerName", sellerName)

    // Call the changeOrderStatus function from sellerHelpers
    await sellerHelpers.changeOrderStatus(orderId, status, sellerName);

    // Assuming status changes were successful, send response with updated status
    let statusText = '';
    if (status === 'confirmed') {
      statusText = 'confirmed';
    } else if (status === 'cancelled') {
      statusText = 'cancelled';
    } else if (status === 'delivered') {
      statusText = 'delivered';
    } else {
      statusText = 'processing';
    }

    // Send JSON response with success status and updated status
    res.json({ success: true, status: statusText });
  } catch (error) {
    // Handle errors
    console.error('Error changing order status:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});


router.get('/add-productname', verifyLogin, (req, res) => {
  res.render('seller/add-productname', { seller: true });
});


router.post('/add-productname', async (req, res) => {
  const productName = req.body.productName; // Assuming productName is submitted in the form

  try {
    await productHelper.addName(productName);
    res.render('seller/add-productname', { seller: true, success: 'Product name added successfully' });
  } catch (error) {
    console.error("Error adding product name: ", error);
    res.render('seller/add-productname', { seller: true, error: 'Error adding product name' });
  }
});


router.get('/api/districts/:state', async (req, res) => {
  const selectedState = req.params.state;
  // console.log(selectedState)
  sellerHelpers.getDistrict(selectedState).then((response) => {
    res.json(response);
  });
});

router.get('/update-stock', async (req, res) => {
  try {
    const seller = req.session.seller; // Assuming seller object is stored in session
    const sellerId = seller._id; // Retrieve seller ID from the seller object
    const products = await productHelpers.getProductStock(sellerId);
    res.render('seller/update-stock', { products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.redirect('/error');
  }
});

router.post('/update-stock', async (req, res) => {
  try {
    const seller = req.session.seller; // Assuming seller object is stored in session
    const sellerId = seller._id; // Retrieve seller ID from the seller object
    const { productid, quantity } = req.body; // Destructure productId and quantity from request body

    console.log("req",req.body)
    console.log('productId:', productid);
    console.log('quantity:', quantity);

    // Update product quantity in the database
    await productHelpers.updateProductQuantity(productid, quantity, sellerId);

    // Redirect to the GET route to render the update-stock page again
    res.redirect('/seller/update-stock');
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.redirect('/error');
  }
});

router.get('/get-Products', async (req, res) => {
  try {
    const seller = req.session.seller; // Assuming seller object is stored in session
    const sellerId = seller._id;
    // console.log(sellerId)
    const products = await productHelpers.getProducts(sellerId);

    //  console.log("products", products);
    res.render('seller/get-Products', { products}); // Remove the leading '/' from the path
  } catch (error) {
    console.error('Error fetching products:', error);
    res.redirect('/error');
  }
});

router.get('/logout', (req, res) => {
  req.session.seller = null;
  res.redirect('/seller/sellerlogin');
})


module.exports = router