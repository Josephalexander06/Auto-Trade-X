var express = require('express');
var router = express.Router();
const sharp = require('sharp');
const sizeOf = require('image-size'); // Import the image-size package
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const sellerHelpers = require('../helpers/seller-helpers');
/* GET users listing. */

router.get('/admin', async function (req, res, next) {
  try {
    const totalOrders = await productHelper.getTotalOrders(); // Fetch total order data

    const totalUsers = await productHelper.getTotalUsers();
    // console.log("orders",totalUsers)

    const totalSales = await productHelper.getTotalSales(); // Fetch total sales

    const totalAmount = await productHelper.getTotalProfit();

    const recentOrders = await productHelpers.getAllRecentOrders();

    const topProducts = await productHelpers.getTopProducts(); // Assuming you have a method to fetch top-selling products


    //  console.log(" totalAmount", totalAmount);
    //  console.log("total sales", totalSales);
     console.log("topProducts", topProducts);

    res.render('admin/admin-view', { admin: true, totalAmount, totalSales, totalUsers, totalOrders, recentOrders, topProducts });
  } catch (error) {
    console.error('Error fetching total orders:', error);
    res.render('error');
  }
});



router.get('/add-product', function (req, res, next) {
  res.render('admin/add-product')
});


router.get('/view-products', async (req, res) => {
  try {
  
    const products = await productHelpers.getSellerProduct();
     console.log(products)
    res.render('admin/view-products', { admin: true,products })
  } catch (error) {
    // If there's an error, send an error response
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

router.post('/add-product', (req, res) => {
  productHelper.addProduct(req.body, (id) => {
    let image = req.files.Image; // Corrected property name

    image.mv('./public/product-images/' + id + '.jpg', (err, done) => {
      if (!err) {
        res.render("admin/add-product");
      } else {
        console.log("Error uploading image", err);
        res.render("admin/add-product", { error: 'Error uploading image.' });
      }
    });
  });
});

router.get('/delete-product/:_id', (req, res) => {
  let productId = req.params._id.trim(); // Trim extra spaces
  productHelper.deleteProduct(productId).then((response) => {
    res.redirect('/admin/');
  });
});

router.get('/edit-product/:_id', async (req, res) => {
  let product = await productHelper.getProductDetails(req.params._id)
  res.render('admin/edit-product', { product })
})

router.post('/edit-product/:_id', (req, res) => {
  let id = req.params._id
  productHelper.updateProduct(req.params.id, req.body).then(() => {
    res.redirect('/admin');
    if (req.files.Image) {
      let image = req.files.Image
      image.mv('./public/product-images/' + id + '.jpg');
    }
  });
});

router.get('/select-store', (req, res) => {
  console.log("store get")
  res.render('admin/select-store', { admin: true });
});

router.get('/add-location', async (req, res) => {
  states = await productHelpers.getStates();
  res.render('admin/add-location', { admin: true, states });
});

router.post('/add-location', (req, res) => {
  // console.log("post received");
  const location = req.body;

  productHelper.addLocation(location).then(() => {
    // console.log("location added");
    res.redirect('/admin/add-location'); // Redirect to the add-location page
  });
});


router.get('/add-district', async (req, res) => {
  const states = await productHelpers.getStates();
  const districts = await productHelpers.getDistricts(); // Implement getDistricts similarly

  res.render('admin/add-district', { admin: true, states, districts });
});


router.get('/view-users-products/', async (req, res) => {
  console.log("get user -prodcrf")
  let users = await userHelpers.getOrderUser(req.params.id)
  let products = await userHelpers.getOrderProducts(req.params.id)
  res.render('admin/view-users-products', { admin: true, users, products })
})

router.delete('/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    // Call a helper function to delete the product from the database
    const result = await productHelpers.deleteProduct(productId);
    if (result.deletedCount === 1) {
      // If the product is deleted successfully
      res.status(200).send('Product deleted successfully');
    } else {
      // If the product with the given ID is not found
      res.status(404).send('Product not found');
    }
  } catch (error) {
    // If an error occurs during the deletion process
    console.error('Error deleting product:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/view-order', async (req, res) => {
  try {
    const orders = await productHelpers.getAllOrders();
    
    // Map over the orders array and fetch the user information for each order
    const ordersWithUsers = await Promise.all(orders.map(async (order) => {
      const user = await userHelpers.getUserById(order.userId); // Invoking the getUserById function from user-helpers.js
      
      // Add order date to each product
      const productsWithDate = order.products.map(product => ({
        ...product,
        orderDate: order.date // Assuming order.date contains the order date
      }));
      
      return { ...order, user, products: productsWithDate }; // Merge order details with user information
    }));
    
    console.log(ordersWithUsers);
    res.render('admin/view-order', { orders: ordersWithUsers }); // Corrected render path
  } catch (error) {
    console.error('Error rendering admin orders page:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/latest-order', async (req, res) => {
  try {
    const orders = await productHelpers.getLatestOrders(30); // Fetch the latest 30 orders
    
    const ordersWithUsers = await Promise.all(orders.map(async (order) => {
      const user = await userHelpers.getUserById(order.userId);
      
      const productsWithDate = order.products.map(product => ({
        ...product,
        orderDate: order.date
      }));
      
      return { ...order, user, products: productsWithDate };
    }));
    
    res.render('admin/latest-order', { orders: ordersWithUsers });
  } catch (error) {
    console.error('Error rendering admin orders page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// View all users
router.get('/view-users', async (req, res) => {
  try {
    const users = await productHelpers.getUser();
    res.render('admin/view-users', { users, admin: true });
  } catch (error) {
    console.error('Error rendering admin view-users page:', error);
    res.redirect('/error');
  }
});

router.get('/view-sellers', async (req, res) => {
  try {
    const sellers = await productHelpers.getSeller();
    res.render('admin/view-sellers', { sellers, admin: true });
  } catch (error) {
    console.error('Error rendering admin view-users page:', error);
    res.redirect('/error');
  }
});

// Block seller
router.get('/seller-block/:id', async (req, res) => {
  const sellerId = req.params.id;
  try {
    await sellerHelpers.blockseller(sellerId); // Call blockseller function passing the seller ID
    res.redirect('/admin/view-sellers'); // Redirect back to the view-sellers page after blocking
  } catch (error) {
    console.error('Error blocking seller:', error);
    res.redirect('/error');
  }
});

// Unblock seller
router.get('/seller-unblock/:id', async (req, res) => {
  const sellerId = req.params.id;
  try {
    await sellerHelpers.unblockseller(sellerId); // Call unblockseller function passing the seller ID
    res.redirect('/admin/view-sellers'); // Redirect back to the view-sellers page after unblocking
  } catch (error) {
    console.error('Error unblocking seller:', error);
    res.redirect('/error');
  }
});

router.get('/user-block/:id', async (req, res) => {
  const sellerId = req.params.id;
  try {
    await userHelpers.blockseller(sellerId); // Call blockseller function passing the seller ID
    res.redirect('/admin/view-users'); // Redirect back to the view-sellers page after blocking
  } catch (error) {
    console.error('Error blocking seller:', error);
    res.redirect('/error');
  }
});

router.get('/user-unblock/:id', async (req, res) => {
  const sellerId = req.params.id;
  try {
    await userHelpers.unblockseller(sellerId); // Call unblockseller function passing the seller ID
    res.redirect('/admin/view-users'); // Redirect back to the view-sellers page after unblocking
  } catch (error) {
    console.error('Error unblocking seller:', error);
    res.redirect('/error');
  }
});

router.get('/add-banner', async(req, res) => {
  let banner = await productHelper.getBanner();
  res.render('admin/add-banner', { admin: true ,banner});
});


router.post('/add-banner', async (req, res) => {
  try {
    const { bannerName } = req.body;
    // console.log(req.files.image)
    const image = req.files.image;

    if (!bannerName) {
      return res.status(400).send('Banner name is required.');
    }

    if (!image) {
      return res.status(400).send('Image is required.');
    }

    // // Check image dimensions
    // const dimensions = sizeOf(image.tempFilePath);
    // const { width, height } = dimensions;

    // // Check if dimensions meet the specified criteria
    // if (width !== 1600 || height !== 265) {
    //   return res.status(400).send('Invalid image dimensions. Image must be 1600px wide and 265px tall.');
    // }
  
    const newBanner = await productHelpers.addBanner({ bannerName });
    console.log(newBanner)
    // Move the image to the appropriate directory
    const bannerId = newBanner._id;
    await image.mv(`./public/banner-images/${bannerId}.jpg`);

    res.redirect('/admin/add-banner');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


router.post('/delete-banner', async (req, res) => {
  try {
    const bannerId = req.body.bannerId; // Retrieve bannerId from the request body

    // Check if the bannerId is valid (You can add more validation if needed)
    if (!bannerId) {
      return res.status(400).send('Banner ID is required.');
    }

    // Perform deletion of the banner using productHelpers.deleteBanner() or your custom logic
    await productHelpers.deleteBanner(bannerId);

    // Send a success response indicating the banner was deleted
    res.status(200).send('Banner deleted successfully.');

  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).send('Server Error');
  }
});


router.get('/view-stock', async (req, res) => {
  try {
    const products = await productHelpers.getStock();
    console.log(products);
    res.render('admin/view-stock', {admin:true ,products });
  } catch (error) {
    console.error('Error fetching product stock:', error);
    res.status(500).json({ error: 'Error fetching product stock' });
  }
});

router.get('/',(req,res)=>{
  res.render('admin/admin-login')
})

router.post('/admin-login',(req,res)=>{
  productHelpers.adminLogin(req.body).then((response)=>{
    if(response.status){
      req.session.admin = response.admin
      req.session.adminloggedIn = true
      res.redirect('/admin/admin')
    }else{
      res.redirect('/admin')
    }
  })
})

router.get('/admin-message', async (req, res) => {
  res.render('admin/admin-message', { admin: true });
});

router.get('/logout', (req, res) => {
  // Clear the admin session
  req.session.admin = null;
  // Redirect the user to the admin login page
  res.redirect('/admin'); // Replace with the actual login page URL
}); 

module.exports = router;
