var express = require('express');
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
const productHelpers = require('../helpers/product-helpers');
/* GET users listing. */
router.get('/', function(req, res, next) {
  productHelpers.getAllProducts().then((products) => {
    res.render('admin/view-products', { admin: true, products });
  });
});


router.get('/add-product',function(req,res,next){
  res.render('admin/add-product')
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

router.get('/edit-product/:_id',async(req,res)=>{
  let product= await productHelper.getProductDetails(req.params._id)
  res.render('admin/edit-product',{product})
})

router.post('/edit-product/:_id', (req, res) => {
  let id=req.params._id
  productHelper.updateProduct(req.params.id, req.body).then(() => {
    res.redirect('/admin');
    if(req.files.Image){
      let image= req.files.Image
      image.mv('./public/product-images/' + id + '.jpg');
    }
  });
});


module.exports = router;
