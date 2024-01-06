var db = require('../config/connection');
var collection = require('../config/collections');
const bcrypt = require('bcrypt');
const { response } = require('../app');
const { log } = require('handlebars');
const common = require('mongodb/lib/bulk/common');
const Razorpay = require('razorpay');
const ObjectID = require('mongodb').ObjectID
var instance= new Razorpay({
    key_id:'rzp_test_xxcqlCHlsEvoWt',
    key_secret:'A5R6L88Sr0VYoxG5N4Ygd7f1',
})

module.exports = {

    doSignup: async (userData) => {
        if (userData && userData.password && typeof userData.password === 'string' && userData.password.length > 0) {
            userData.password = await bcrypt.hash(userData.password, 10);
            const result = await db.get().collection(collection.USER_COLLECTION).insertOne(userData);
            return result.ops[0];
        } else {
            console.log('Invalid password provided or missing');
        }
    },
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let response = {};
           let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email:userData.username });
            if (user) {
                bcrypt.compare(userData.password, user.password).then((status) => {
                    if (status) {
                        response.user=user
                        response.status=true
                        resolve(response)
                    } else {
                        resolve({status:false})
                    }
                });
            } else {
                resolve({status:false})
            }
        });
    },
    
    addTocart: async (productId, userId) => {
        let product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(productId) });
        let proObj = {
            item: ObjectID(productId),
            quantity: 1,
            name: product.productName,  // Add product name to cart
            productId: product._id, // Add product ID to cart
            sellingAmount:product.sellingPrice,//Add Selling Amount
        };
       
        return new Promise(async(resolve,reject)=>{
            let userCart=await db.get().collection(collection.CART_COLLECTION).findOne({user:ObjectID(userId)})
            if(userCart){
                let prodExit=userCart.products.findIndex(product=> product.item==productId)
                if(prodExit!=-1){
                    db.get().collection(collection.CART_COLLECTION)
                    .updateOne({user:ObjectID(userId),'products.item':ObjectID(productId)},
                    {
                        $inc:{'products.$.quantity':1}
                    }).then(()=>{
                        resolve()
                    })
                }else{
                db.get().collection(collection.CART_COLLECTION).updateOne({user:ObjectID(userId)},{
                        $push:{products:proObj} 
                }
                ).then((response)=>{
                    resolve()
                })
            }
            }else{
                let cartObj={
                    user:ObjectID(userId),
                    products:[proObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response)=>{
                    resolve()
                })
            }
        })
    }
  ,
    getCartProduct: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: {
                        user: ObjectID(userId),
                    }
                },
                {
                    $unwind: '$products'

                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity',
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField:'_id',
                        as:'product',
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                }
                
            
            ]).toArray();
            resolve(cartItems);
        });
    },
    getCartCount:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let count=0
            let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:ObjectID(userId)})
            if(cart)
            {
                count=cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity:(details)=>{
        details.count=parseInt(details.count)
        details.quantity=parseInt(details.quantity)
        return new Promise((resolve,reject)=>{
            if( details.count==-1&& details.quantity==1 )
            {
                db.get().collection(collection.CART_COLLECTION)
                .updateOne({_id:ObjectID(details.cart)},
                    {
    
                        $pull:{products:{item:ObjectID(details.product)}}
                    }
                    ).then((response)=>{
                    resolve({removeProduct:true})
                })
            }else
            {
                db.get().collection(collection.CART_COLLECTION)
                .updateOne({_id:ObjectID(details.cart),'products.item':ObjectID(details.product)},
                {
                    $inc:{'products.$.quantity':details.count}
                }).then((response)=>{
                    resolve({status:true})
                })
            }
        })
    },
    deleteProduct:(details)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.CART_COLLECTION)
            .updateOne({_id:ObjectID(details.cart)},
                {

                    $pull:{products:{item:ObjectID(details.product)}}
                }
                ).then((response)=>{
                    console.log('remove success')
                resolve({removeProduct:true})
            })
        })
    },
    getTotalAmount:(userId)=>{
        return new Promise(async (resolve, reject) => {
            let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: {
                        user: ObjectID(userId),
                    }
                },
                {
                    $unwind: '$products'

                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity',
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField:'_id',
                        as:'product',
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                $group:{
                    _id:null,
                    total: {
                        $sum: {
                            $multiply: [
                                { $toDouble: '$quantity' },
                                { $toDouble: '$product.sellingPrice' }
                            ]
                        }
                    }
                } 
            },
            ]).toArray();
            resolve(total[0].total);
        });
    },

    getTotalQuantity: (userId) => {
        return new Promise(async (resolve, reject) => {
          let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {
              $match: {
                user: ObjectID(userId),
              }
            },
            {
              $unwind: '$products'
            },
            {
              $group: {
                _id: null,
                totalQuantity: {
                  $sum: { $toInt: '$products.quantity' }
                }
              }
            }
          ]).toArray();
        //   console.log(total[0].totalQuantity)
          resolve(total[0].totalQuantity);
        });
      },
      generateReceiptId:()=> {
        // Generate a random receipt ID
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = 15;
        let receiptId = '';
      
        for (let i = 0; i < length; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          receiptId += characters.charAt(randomIndex);
        }
      
        return receiptId;
      },
      
      placeOrder: (order, products, total, receiptId) => {
        return new Promise(async (resolve, reject) => {
             console.log(order, products, total);
            let status = order['payment-method'] === "COD" ? 'placed' : 'pending';
    
            let orderObj = {
                deliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    city: order.city,
                    zipcode: order.zipCode
                },
                userId: ObjectID(order.userId),
                paymentMethod: order['payment-method'],

                products: products.map((product) => ({
                    name: product.name,
                    productId:product.productId || null,
                    quantity: product.quantity,
                    sellingAmount: product.sellingAmount,
                    date: new Date(),
                    receiptId: receiptId,
                    // totalAmount: total,
                })),
                status: status,
            };
    
            try {
                let response = await db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj);
                await db.get().collection(collection.CART_COLLECTION).removeOne({ user: ObjectID(order.userId) });
                // console.log(response.ops[0]._id);
                resolve(response.ops[0]._id);
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }
    
    ,

    // Example of adding a product to the cart and then fetching the updated cart
 addProductToCartAndFetch:(userId, productId) =>{
     return new Promise(async (resolve, reject) => {
        try {
            await addToCart(userId, productId); // Assume you have a function for adding to the cart
            const cartProducts = await getCartProductList(userId);
            // console.log("Updated Cart:", cartProducts);
            resolve(cartProducts);
        } catch (error) {
            console.error(error);
            reject(error);
        }
    })
},

getCartProductList:(userId)=>{
    return new Promise(async(resolve,reject)=>{
        let cart= await db.get().collection(collection.CART_COLLECTION).findOne({user:ObjectID(userId)})
        console.log(cart.products)
         resolve(cart.products)
    })
}, 
getUserOrder:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let orders= await db.get().collection(collection.ORDER_COLLECTION)
            .find({userId:ObjectID(userId)}).toArray();
              console.log("Ordersss"+orders)
            resolve(orders)  
        })
    },
    getOrderProducts:(orderId)=>{
        return new Promise(async(resolve,reject)=>{
            let orderItems= await db.get().collection(collection.ORDER_COLLECTION)
            .aggregate([
                {
                    $match:{_id:ObjectID(orderId)}
                },
                {
                    $unwind:'$products'
                },
                {
                    $project:{
                        item:'$products.item',
                        quantity:'$products.quantity'
                    }
                },
                {
                    $lookup:{
                        from:collection.PRODUCT_COLLECTION,
                        localField:'item',
                        foreignField:'_id',
                        as:'product'
                    }
                }
            ]).toArray()
            resolve(orderItems)
        })
    },
    cancelOrder:(orderId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.ORDER_COLLECTION)
            .updateOne({_id:ObjectID(orderId)},
            {
                $set:{
                    status:'cancelled'
                }
            }).then((response)=>{
                resolve()
            })
        })
    },
    generateRazorpay:(OrderId,totalPrice)=>{
        return new Promise((resolve,reject)=>{
            var options = {
                amount: totalPrice*100,  // amount in the smallest currency unit
                currency: "INR",
                receipt:OrderId
              };
              instance.orders.create(options, function(err, order) {
                if(err){
                    console.log(err)
                }else{
                // console.log(order);
                resolve(order);
                }
              });
        })
    },
    verifyPayment :(details)=>{
        return new Promise((resolve,reject)=>{
            const crypto = require('crypto')
            let hmac = crypto.createHmac('sha256','A5R6L88Sr0VYoxG5N4Ygd7f1')
            hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]'])
            hmac=hmac.digest('hex')
            if(hmac==details['payment[razorpay_signature]']){
                resolve()
            }else{
                reject()
            }
        })
    },
    changePaymentStatus:(orderId)=>{
        return new Promise((resolve,reject)=>{
           db.get().collection(collection.ORDER_COLLECTION)
           .updateOne({_id:ObjectID(orderId)},
           {
               $set:{
                   status:'placed'
               }
           }).then(()=>{
            resolve()
           })
        })
    }
};
