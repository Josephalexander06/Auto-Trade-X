var express = require('express');
var router = express.Router();
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const Razorpay = require('razorpay');

var instance = new Razorpay({
  key_id: 'rzp_test_xxcqlCHlsEvoWt',
  key_secret: 'A5R6L88Sr0VYoxG5N4Ygd7f1',
})

const verifyLogin = (req, res, next) => {
  if (req.session.user) {
    next()
  } else {
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/', async function (req, res, next) {
  let user = req.session.user
  let cartCount = null
  let banner = await productHelpers.getBanner();
  console.log(banner)
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id)
  }
  productHelpers.getAllProducts().then((products) => {
    res.render('user/view-products', { products, user, cartCount, banner });
    // console.log('cart' + cartCount)
  });
});

router.get('/login', (req, res) => {
 
    res.render('user/login', { loginErr: req.session.userLoginErr });
    req.session.userLoginErr = false;
});


router.get('/signup', (req, res) => {
  res.render('user/signup')
})

router.post('/signup', (req, res) => {
  console.log(req.body)
  const userData = {
    name: req.body.fname,
    email: req.body.email,
    password: req.body.password,
    isBlocked: false // Set isBlocked to false by default
  };

  userHelpers.doSignup(userData)
    .then((response) => {
      req.session.user = response;
      req.session.user.loggedIn = true;
      res.redirect('/login'); // Redirect to user login page
    })
    .catch((error) => {
      console.error('Signup failed:', error);
      res.status(500).send('Signup failed. Please try again.');
    });
});


router.get('/verify-otp', (req, res) => {
  res.render('user/verify-otp', { otpSecret: req.session.otpSecret });
})

router.post('/login', async (req, res) => {
  try {
      console.log(req.body);
      const response = await userHelpers.doLogin(req.body);
      if (response.status) {
          const user = response.user;

          if (user.isBlocked) {
              req.session.userLoginErr = "Your account is blocked. Please contact support.";
              res.redirect('/login');
              return;
          }

          // Store the user's email in the session
          req.session.userEmail = req.body.username;
          console.log(req.session.userEmail)
          // Generate and send OTP
          const secret = await userHelpers.generateOTP(req.body.username);
          console.log(secret)

          // Store secret in session using a unique key
          req.session.otpSecret = secret;
          req.session.user = user;
          req.session.user.loggedIn = true;

          // Redirect user to OTP verification page
          res.redirect('/verify-otp');
      } else {
          req.session.userLoginErr = "Please enter a valid username or password";
          res.redirect('/login');
      }
  } catch (error) {
      console.error('Error during login:', error);
      req.session.userLoginErr = "Internal Server Error";
      res.redirect('/login');
  }
});

router.post('/verify-otp', async (req, res) => {
  const { otp } = req.body;

  try {
      // Verify OTP
      const isValid = await userHelpers.verifyOTP(otp, req.session.otpSecret);
      console.log("isValid", isValid);
      if (isValid) {
          // OTP is valid, proceed with login or further actions
          res.redirect('/'); // Redirect to the home page or another appropriate route
      } else {
          // Invalid OTP, redirect back to the OTP verification page
          res.redirect('/verify-otp');
      }
  } catch (error) {
      console.error('Error while verifying OTP:', error);
      res.send('Error while verifying OTP');
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
      // Fetch the user's email from the request body
    // console.log(req.session.userEmail)
      // Generate and send OTP to the provided email
      const secret = await userHelpers.generateOTP( req.session.userEmail);
      req.session.otpSecret = secret;

      // Send success response
      res.sendStatus(200);
  } catch (error) {
      console.error('Error resending OTP:', error);
      // Send error response
      res.sendStatus(500);
  }
});


router.get('/logout', (req, res) => {
  req.session.user = null
  res.redirect('/')
})


router.get('/cart', verifyLogin, async (req, res) => {
  let products = await userHelpers.getCartProduct(req.session.user._id);
  let totalValue = 0;
  let totalQuantity = 0;

  if (products.length > 0) {
    totalValue = await userHelpers.getTotalAmount(req.session.user._id);
    totalQuantity = await userHelpers.getTotalQuantity(req.session.user._id);
  }
  console.log(totalValue)
  res.render('user/cart', { products, user: req.session.user, totalValue, totalQuantity });
});


router.post('/change-product-quantity', (req, res, next) => {
  userHelpers.changeProductQuantity(req.body).then(async (response) => {
    response.total = await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })
})


router.post('/delete-product', (req, res, next) => {
  // console.log(req.body)
  userHelpers.deleteProduct(req.body).then((response) => {
    res.json(response)
  })
})

router.get('/place-order', verifyLogin, async (req, res) => {
  let total = await userHelpers.getTotalAmount(req.session.user._id)

  res.render('user/place-order', { total, user: req.session.user })
})



router.get('/order-place', verifyLogin, (req, res) => {
  res.render('user/order-place', { user: req.session.user._id })
})


router.get('/orders', verifyLogin, async (req, res) => {
  let orders = await userHelpers.getUserOrder(req.session.user._id);
     console.log("orderzz",orders)
  res.render('user/orders', { user: req.session.user, orders });
});


router.post('/cancel-order', async (req, res) => {
  await userHelpers.cancelOrder(req.body.order)
  res.json({ removeProduct: true })
})

router.post('/place-order', async (req, res) => {
  try {
    console.log(req.body)
    // Get the list of products in the cart
    let products = await userHelpers.getCartProductList(req.body.userId);

    // Calculate the total price of the order
    let totalPrice = await userHelpers.getTotalAmount(req.body.userId);

    // Generate a random receipt ID
    const receiptId = await userHelpers.generateReceiptId();

    // Place the order and get the order ID
    let orderId = await userHelpers.placeOrder(req.body, products, totalPrice, receiptId);

    // Generate Razorpay payment details
    let razorpayDetails = await userHelpers.generateRazorpay(orderId, totalPrice);

    // Send the response containing Razorpay payment details
    res.json(razorpayDetails);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Error placing order' });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    console.log('Request Body:', req.body); // Log the entire request body

    // Verify the payment
    await userHelpers.verifyPayment(req.body);

    // Change the order status to 'processing'
    const orderId = req.body['order[receipt]']; // Assuming orderId is received correctly
    await userHelpers.changeOrderStatus(orderId, 'processing');

    console.log('Payment Success');
    res.json({ status: 'success' }); // Send success status
  } catch (error) {
    console.error('Error verifying or changing payment status:', error);
    res.json({ status: 'failure', error: 'Error verifying or changing payment status' }); // Send failure status with error message
  }
});




// Your route for /get-districts
router.get('/get-districts', async (req, res) => {
  const selectedStateId = req.query.stateId;

  try {
    const districts = await userHelpers.getDistrictByState(selectedStateId);
    res.json(districts);
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/select-store', verifyLogin, async (req, res) => {
  try {
    const product = req.query;
    const [states, districts, stores] = await Promise.all([
      userHelpers.getStates(),
      userHelpers.getDistricts(),
      userHelpers.getStores(),
    ]);
    console.log("Pro", product)
    res.render('user/select-store', { states, districts, stores, product, user: req.session.user, });
  } catch (error) {
    console.error('Error fetching states, districts, and stores:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/select-store', verifyLogin, async (req, res) => {
  try {
    const productId = req.body.productId; // Access productId from req.body
    const { state, district, selectedStore } = req.body;
    // console.log("ID", productId); 
    if (!selectedStore) {
      throw new Error('Please select a store before adding to the cart');
  }else{
    await userHelpers.addTocart(req.session.user._id, productId, selectedStore);
  }
    res.redirect('/cart'); // Redirect the user to their cart after adding the product
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/api/districts/:state', async (req, res) => {
  const selectedState = req.params.state;
  // console.log(selectedState)
  userHelpers.getDistricts(selectedState).then((response) => {
    res.json(response);
  });
});


router.get('/api/getVehicleNames', async (req, res) => {
  try {
    // Fetch vehicle names from your data source (e.g., database)
    const vehicleNames = await productHelpers.getAllVehicleNames();

    // Send the response with the vehicle names
    res.json({ vehicleNames });
  } catch (error) {
    console.error("Error fetching vehicle names", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/productdetails/:productId',verifyLogin, async (req, res) => {
  try {
    const productId = req.params.productId;
    const productDetails = await userHelpers.getProductDetails(productId);
    res.render('user/productdetails', { productDetails }); // Assuming you want to pass productDetails data to the view
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});

router.get('/api/sellers', async (req, res) => {
  try {
    const { productId, state, district } = req.query;
    // console.log("ID", productId); 
    // Perform MongoDB query to find sellers based on state and district
    const sellers = await userHelpers.getSellersByLocation(state, district, productId);

    res.json(sellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/search', async function (req, res) {
  console.log("body", req.body);
  const searchTerm = req.body.searchTerm;
  let user = req.session.user;

  try {
      // Build search criteria
      const searchCriteria = {
          $or: [
              { vehicleName: { $regex: searchTerm, $options: 'i' } },
              { year: { $regex: searchTerm, $options: 'i' } },
              { color: { $regex: searchTerm, $options: 'i' } },
              { mileage: { $regex: searchTerm, $options: 'i' } },
              { BookingAmount: { $regex: searchTerm, $options: 'i' } },
              { Discount: { $regex: searchTerm, $options: 'i' } },
              { engine: { $regex: searchTerm, $options: 'i' } },
              { description: { $regex: searchTerm, $options: 'i' } },
              { transmission: { $regex: searchTerm, $options: 'i' } },
              { fuelType: { $regex: searchTerm, $options: 'i' } },
              { numDoors: { $regex: searchTerm, $options: 'i' } },
              { numSeats: { $regex: searchTerm, $options: 'i' } },
              // Search for any features provided by the user
              { features: { $regex: searchTerm, $options: 'i' } }
          ]
      };

      // Search for products based on the search criteria
      const result = await productHelpers.searchProducts(searchCriteria);
      console.log(result)
      let products = result.products;

      res.render('user/search', { products, searchTerm, user });
  } catch (error) {
      console.error("Error searching products:", error);
      res.render('error');
  }
});



router.get('/api/orders/:orderId', async (req, res) => {
  try {
      const orderId = req.params.orderId;
      console.log("param",req.params.orderId)
      const order = await userHelpers.getOrders(orderId);

      if (order) {
          res.json(order);
      } else {
          res.status(404).json({ error: 'Order not found' });
      }
  } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/compare', async (req, res) => {
  try {
      // Retrieve the comparison list from query parameters
      const productIds = req.query.products ? req.query.products.split(',') : [];

      // Get the details of the first product in the comparison list
      const product1 = await userHelpers.getProductById(productIds[0]);

      // Get the details of the second product in the comparison list
      const product2 = await userHelpers.getProductById(productIds[1]);

      console.log(product1, product2);
      
      // Pass the products data to the frontend
      res.render('user/compare', { product1: product1, product2: product2 });
  } catch (error) {
      console.error('Error getting products for comparison:', error);
      res.status(500).send('Internal Server Error');
  }
});







module.exports = router;
