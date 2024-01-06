var express = require('express');
var router = express.Router();
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const { response } = require('../app');

const verifyLogin = (req, res, next) => {
  if (req.session.loggedIn) {
    next()
  } else {
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/', async function (req, res, next) {
  let user = req.session.user
  let cartCount = null
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id)
  }
  productHelpers.getAllProducts().then((products) => {
    res.render('user/view-products', { products, user, cartCount });
    // console.log('cart' + cartCount)
  });
});

router.get('/login', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/')
  } else {
    res.render('user/login', { 'loginErr': req.session.loginErr })
    req.session.loginErr = false
  }
})

router.get('/signup', (req, res) => {
  res.render('user/signup')
})

router.post('/signup', (req, res) => {
  userHelpers.doSignup(req.body).then((response) => {
    // console.log(response)
    req.session.loggedIn = true
    req.session.user = response
    res.redirect('/')
  })
})

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.loggedIn = true
      req.session.user = response.user
      res.redirect('/')
    } else {
      req.session.loginErr = "Please Enter Valid Username or Passsword"
      res.redirect('/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.destroy()
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
  res.render('user/cart', { products, user: req.session.user, totalValue, totalQuantity });
});


router.get('/add-to-cart/:_id', verifyLogin, (req, res) => {
  userHelpers.addTocart(req.params._id, req.session.user._id).then(() => {
    res.json({ status: true });
  });
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

router.post('/place-order', async (req, res) => {
  let products = await userHelpers.getCartProductList(req.body.userId)

  let totalPrice = await userHelpers.getTotalAmount(req.body.userId)
  const receiptId = await userHelpers.generateReceiptId(); // Generate random receipt ID

  // console.log(receiptId);
  userHelpers.placeOrder(req.body, products, totalPrice, receiptId).then((OrderId) => {
    if (req.body['payment-method' === 'COD']) {
      res.json({ cod_Success: true })
    } else {
      userHelpers.generateRazorpay(OrderId, totalPrice).then((response) => {
        res.json(response)
      })
    }
  })
  //  console.log(req.body)
})

router.get('/order-place', verifyLogin, (req, res) => {
  res.render('user/order-place', { user: req.session.user._id })
})


router.get('/orders', verifyLogin, async (req, res) => {
  let orders = await userHelpers.getUserOrder(req.session.user._id);

  res.render('user/orders', { user: req.session.user, orders });
});


router.get('/view-order-products/:id', verifyLogin, async (req, res) => {
  let order = await userHelpers.getOrderProducts(req.params.id)
  res.render('user/view-order-products', { user: req.session.user, order })
})


router.post('/cancel-order', async (req, res) => {
  await userHelpers.cancelOrder(req.body.order)
  res.json({ removeProduct: true })
})

router.post('/verify-payment', (req, res) => {
  // console.log(req.body)
  userHelpers.verifyPayment(req.body).then(() => {
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(() => {
      console.log('payment Success')
      res.json({ status: true })
    }).catch((err) => {
      console.log(err)
      res.json({ status: false, errMsg: 'Payment Failed' })
    })
  })

  
})

module.exports = router;
