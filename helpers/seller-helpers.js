var db = require('../config/connection');
var collection = require('../config/collections');
const bcrypt = require('bcrypt');
const ObjectID = require('mongodb').ObjectID


module.exports = {

    sellerSignup: async (sellerData) => {
        if (sellerData && sellerData.password && typeof sellerData.password === 'string' && sellerData.password.length > 0) {
            sellerData.password = await bcrypt.hash(sellerData.password, 10);
            const result = await db.get().collection(collection.SELLER_COLLECTION).insertOne(sellerData);
            return result.ops[0];
        } else {
            console.log('Invalid password provided or missing');
        }
    },
    sellerLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let response = {};
            let seller = await db.get().collection(collection.SELLER_COLLECTION).findOne({ semail: userData.username });
            if (seller) {
                bcrypt.compare(userData.password, seller.password).then((status) => {
                    if (status) {
                        response.seller = seller
                        response.status = true
                        resolve(response)
                    } else {
                        resolve({ status: false })
                    }
                });
            } else {
                resolve({ status: false })
            }
        });
    },
    getSellerOrders: (sellerId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let sellerOrders = await db.get().collection(collection.ORDER_COLLECTION)
                    .find({ sellerId: ObjectID(sellerId) }).toArray();
                console.log("Seller Orders: ", sellerOrders);
                resolve(sellerOrders);
            } catch (error) {
                console.error("Error fetching seller orders: ", error);
                reject(error);
            }
        });
    },
    getStates: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let states = await db.get().collection(collection.STATE_COLLECTION).find().toArray();
                resolve(states);
            } catch (error) {
                reject(error);
            }
        });
    },

    getDistrictsByState: (stateName) => {
        return new Promise(async (resolve, reject) => {
            try {
                let districts = await db.get().collection(collection.DISTRICT_COLLECTION).find({ stateName }).toArray();
                resolve(districts);
            } catch (error) {
                reject(error);
            }
        });
    },
    getDistrict: (selectedState) => {
        return new Promise(async (resolve, reject) => {
            try {
                // console.log('Selected State:', selectedState);

                const districts = await db.get()
                    .collection(collection.DISTRICT_COLLECTION)
                    .find({ state: selectedState })
                    .toArray();

                // console.log("Dis", districts); // Log districts to help debug

                resolve(districts);
            } catch (error) {
                console.error('Error fetching districts:', error);
                reject(error);
            }
        });
    },
    changeOrderStatus: (orderId, status, sellerName) => {
      return new Promise(async (resolve, reject) => {
          if (!ObjectID.isValid(orderId)) {
              reject(new Error('Invalid orderId format'));
              return;
          }
  
          let updateData = {};
          if (status === 'confirmed') {
              updateData = { $set: { status: 'confirmed', seller: sellerName } };
          } else if (status === 'cancelled') {
              updateData = { $set: { status: 'cancelled', seller: sellerName } };
          } else if (status === 'delivered') {
              updateData = { $set: { status: 'delivered', seller: sellerName } };
          } else {
              updateData = { $set: { status: 'processing', seller: sellerName } }; // Default to processing
          }
  
          try {
              // Update the order status
              await db.get().collection(collection.ORDER_COLLECTION)
                  .updateOne({ _id: ObjectID(orderId) }, updateData);
  
              // If the status is confirmed, decrement the product quantity
              if (status === 'confirmed') {
                  // Get the order details
                  const order = await db.get().collection(collection.ORDER_COLLECTION)
                      .findOne({ _id: ObjectID(orderId) });
  
                  // For each product in the order, decrement the quantity in the product collection
                  for (const item of order.products) {
                      await db.get().collection(collection.PRODUCT_COLLECTION)
                          .updateOne({ _id: ObjectID(item.productId) }, { $inc: { quantity: -item.quantity } });
                  }
              }
  
              resolve();
          } catch (error) {
              console.error('Error changing order status:', error);
              reject(error);
          }
      });
  },  
    blockseller: async (sellerId) => {
        try {
            const objectId = new ObjectID(sellerId); // Convert sellerId string to ObjectId
            await db.get().collection(collection.SELLER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: true } }); // Set isBlocked to true
        } catch (error) {
            console.error('Error blocking seller:', error);
            throw error;
        }
    },
    
      unblockseller: async (sellerId) => {
        try {
            const objectId = new ObjectID(sellerId);
          await db.get().collection(collection.SELLER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: false } }); // Set isBlocked to false
        } catch (error) {
          console.error('Error unblocking seller:', error);
          throw error;
        }
      },
      getTotalSales: async (sellerId) => {
        try {
          const totalSales = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({
            sellerId: ObjectID(sellerId),
            status: "delivered"
          });
        //   console.log("Total sales for seller:", totalSales);
          return totalSales;    
        } catch (error) {
          console.error('Error fetching total sales:', error);
          throw error;
        }
      },      
      getTotalOrders: async (sellerId) => {
        try {
          const totalOrders = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({ sellerId: ObjectID(sellerId),});
        //   console.log("totalOrders",totalOrders);
          return totalOrders;
        } catch (error) {
          console.error('Error fetching total orders:', error);
          throw error;
        }
      },
    
      getTotalAmount: (sellerId) => {
        return new Promise(async (resolve, reject) => {
          try {
            // Fetch orders with status "delivered" and belonging to the specific seller
            const deliveredOrders = await db.get().collection(collection.ORDER_COLLECTION)
              .find({ sellerId: ObjectID(sellerId), status: "delivered" })
              .toArray();
      
            // Calculate total profit from delivered orders
            let totalProfit = 0;
            deliveredOrders.forEach(order => {
              if (order.products && order.products.length > 0) {
                order.products.forEach(product => {
                  if (product.totalAmount && !isNaN(parseFloat(product.totalAmount)) && !isNaN(parseInt(product.quantity))) {
                    totalProfit += parseFloat(product.totalAmount);
                  } else {
                    console.log("Invalid product:", product);
                  }
                });
              }
            });
      
            // Resolve with total profit
            resolve(totalProfit);
          } catch (error) {
            reject(error);
          }
        });
      }
      
}
