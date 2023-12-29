
var db = require('../config/connection');
var collection = require('../config/collections')
const ObjectID = require('mongodb').ObjectID
module.exports = {
  addProduct: (product, callback) => {
    console.log(product)
    db.get().collection('product').insertOne(product).then((data) => {
      console.log(data);
      callback(data.insertedId.toString())
    })
  },
  getAllProducts: () => {
    return new Promise(async (resolve, reject) => {
      let products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
      resolve(products)
    })
  },
  deleteProduct: (productId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: ObjectID(productId) }).then((response) => {
        resolve(response);
      }).catch((err) => {
        reject(err);
      });
    });
  },
  getProductDetails:(productId)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:ObjectID(productId)}).then((product)=>{
        resolve(product)
      })
    })
  },
  updateProduct:(productId,productDetails)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:ObjectID(productId)},{
        $set:{
          productName:productDetails.productName,
          productDescription:productDetails.productDescription,
          productPrice:productDetails.productPrice,
          productCategory:productDetails.productCategory,
        }
      }).then((response)=>{
        resolve()
      })
    })
  }
};
