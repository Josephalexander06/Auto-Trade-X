var express = require('express');
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');

/* GET client listing. */
// Handler for the first route
router.get('/', function(req, res, next) {
  productHelpers.getAllProducts().then((products)=>{
    res.render('client/view-products', {client:true,products})
  })
});



module.exports=router