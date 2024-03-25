var db = require('../config/connection');
var collection = require('../config/collections')
const ObjectID = require('mongodb').ObjectID
module.exports = {

  // Modified addProduct function to store seller ID as ObjectId
  addProduct: (product, callback) => {
    console.log(product);
    product.seller = ObjectID(product.seller); // Convert seller ID to ObjectId
    db.get().collection('product').insertOne(product).then((data) => {
      callback(data.insertedId.toString());
    });
  },
  getAllProducts: () => {
    return new Promise(async (resolve, reject) => {
      try {

        // const totalOrders = await db.get().collection(collection.ORDER_COLLECTION).countDocuments();

        const productNames = await db.get().collection(collection.PRODUCT_COLLECTION).distinct('vehicleName');
        const uniqueProducts = [];

        for (const productName of productNames) {
          const product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ vehicleName: productName });
          uniqueProducts.push(product);
        }

        resolve(uniqueProducts);
      } catch (error) {
        reject(error);
      }
    });
  }
  ,
  deleteProduct: (productId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: ObjectID(productId) }).then((response) => {
        resolve(response);
      }).catch((err) => {
        reject(err);
      });
    });
  }
  ,
  //   updateProduct:(productId,productDetails)=>{
  //     return new Promise((resolve,reject)=>{
  //       db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:ObjectID(productId)},{
  //         $set:{
  //           productName:productDetails.productName,
  //           originalPrice:productDetails.originalPrice,
  //           sellingPrice:productDetails.sellingPrice,
  //           discountPrecentage:productDetails.discountPrecentage,
  //         }
  //       }).then((response)=>{
  //         resolve()
  //       })
  //     })
  //   }
  updateProduct: (productId, productDetails) => {
    return new Promise((resolve, reject) => {
      const filter = { _id: ObjectID(productId) };
      const update = {
        $set: {
          productName: productDetails.productName,
          originalPrice: productDetails.originalPrice,
          sellingPrice: productDetails.sellingPrice,
          discountPrecentage: productDetails.discountPrecentage,
        },
      };

      db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .updateOne(filter, update)
        .then((result) => {
          if (result.modifiedCount > 0) {
            // If at least one document was modified, consider it a success
            resolve({ success: true });
          } else {
            // If no documents were modified, consider it a failure
            resolve({ success: false, message: "No matching document found" });
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  },
  getOneProductDetails: (productId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(productId) }).then((product) => {
        resolve(product)
      })
    })
  },

  getAllVehicleNames: () => {
    return new Promise((resolve, reject) => {
      const collect = db.get().collection(collection.PRODUCTNAME_COLLECTION);
      collect.distinct('name', (err, vehicleNames) => {
        if (err) {
          reject(err);
        } else {
          resolve(vehicleNames);
        }
      });
    });
  },

  addLocation: (location) => {
    return new Promise(async (resolve, reject) => {
      try {
        let insertedId;
        if (location.districtName) {
          // If districtName is present, insert into districts collection
          const data = await db.get().collection(collection.DISTRICT_COLLECTION).insertOne(location);
          insertedId = data.insertedId.toString();
        } else {
          // Insert into states collection
          const data = await db.get().collection(collection.STATE_COLLECTION).insertOne(location);
          insertedId = data.insertedId.toString();
        }

        resolve(insertedId);
      } catch (error) {
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


  getDistricts: () => {
    return new Promise(async (resolve, reject) => {
      let districts = await gb.get().collection(collection.DISTRICT_COLLECTION).find().toArray()
      if (districts) {
        resolve(districts)
      } else {
        reject
      }
    })
  },

  getUser: () => {
    return new Promise(async (resolve, reject) => {
      let user = await db.get().collection(collection.USER_COLLECTION).find().toArray()
      if (user) {
        resolve(user)
      } else {
        console.log("user err")
      }

    }
    )
  },
  getSeller: () => {
    return new Promise(async (resolve, reject) => {
      let seller = await db.get().collection(collection.SELLER_COLLECTION).find().toArray()
      if (seller) {
        resolve(seller)
      } else {
        console.log("user err")
      }

    }
    )
  },
  // productHelper.js
  addName: (name) => {
    return new Promise((resolve, reject) => {
      const collect = db.get().collection(collection.PRODUCTNAME_COLLECTION);
      collect.insertOne({ name: name }) // Assuming 'name' is the key for the product name
        .then(result => {
          console.log("Name added successfully: ", result);
          resolve(result);
        })
        .catch(error => {
          console.error("Error adding name: ", error);
          reject(error);
        });
    });
  },
  getAllVehicleNames: () => {
    return new Promise((resolve, reject) => {
      const collect = db.get().collection(collection.PRODUCTNAME_COLLECTION);
      collect.distinct('name', (err, vehicleNames) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(vehicleNames);
        }
      })
    })
  },
  getProductById: (productId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(productId) }, (err, product) => {
        if (err) reject(err);
        else resolve(product);
      });
    });
  },

  getSellersByProductId: (productId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.SELLER_COLLECTION).find({ products: { $elemMatch: { productId: ObjectID(productId) } } }).toArray((err, sellers) => {
        if (err) reject(err);
        else resolve(sellers);
      });
    });
  },
    searchProducts: (searchCriteria) => {
        return new Promise((resolve, reject) => {
            // Perform the MongoDB query using the provided search criteria
            db.get().collection(collection.PRODUCT_COLLECTION)
                .find(searchCriteria)
                .toArray((error, products) => {
                    if (error) {
                        console.error('Error searching products:', error);
                        reject(new Error('Error searching products:', error));
                    } else {
                        resolve({ products });
                    }
                });
        });
    },
getTotalOrders: () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch total number of orders
        const totalOrders = await db.get().collection(collection.ORDER_COLLECTION).countDocuments();
        // Resolve with total orders and unique products
        resolve({ totalOrders });
      } catch (error) {
        reject(error);
      }
    });
  },
  getTotalUsers: () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch total number of orders
        const totalUsers = await db.get().collection(collection.USER_COLLECTION).countDocuments();
        // Resolve with total orders and unique products
        resolve({ totalUsers });
      } catch (error) {
        reject(error);
      }
    });
  },
  getTotalSales: () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Count total sales based on orders with status "confirmed"
        const totalSales = await db.get().collection(collection.ORDER_COLLECTION)
          .countDocuments({ status: "delivered" });

        // console.log("total confirmed sales:", totalSales);

        // Resolve with total sales count
        resolve(totalSales);
      } catch (error) {
        reject(error);
      }
    });
  },
  getTotalProfit: () => {
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch orders with status "delivered"
        const deliveredOrders = await db.get().collection(collection.ORDER_COLLECTION)
          .find({ status: "delivered" })
          .toArray();

        // Calculate total profit from delivered orders
        let totalProfit = 0;
        deliveredOrders.forEach(order => {
          order.products.forEach(product => {
            const revenue = parseFloat(product.totalAmount); // Convert BookingAmount to a numeric value
            const quantity = parseInt(product.quantity); // Convert quantity to an integer value

            if (!isNaN(revenue) && !isNaN(quantity)) {
              totalProfit += revenue;
            } else {
              console.log("Invalid revenue or quantity:", product);
            }
          });
        });

        // console.log("Total profit:", totalProfit);

        // Resolve with total profit
        resolve(totalProfit);
      } catch (error) {
        reject(error);
      }
    });
  },


  getAllRecentOrders: async () => {
    const orders = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
      {
        $lookup: {
          from: collection.USER_COLLECTION,
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $unwind: '$products' // Unwind the products array
      },
      {
        $addFields: {
          // Convert the date string to ISO 8601 format ('YYYY-MM-DD')
          isoDate: {
            $dateFromParts: {
              year: { $toInt: { $substr: ['$products.date', 6, 4] } },
              month: { $toInt: { $substr: ['$products.date', 3, 2] } },
              day: { $toInt: { $substr: ['$products.date', 0, 2] } }
            }
          }
        }
      },
      {
        $group: {
          _id: '$_id', // Group by order ID
          date: { $first: '$isoDate' }, // Use the converted ISO date
          customer: { $first: '$user.fname' }, // Assuming the customer's first name is stored in the 'fname' field of the user collection
          status: { $first: '$status' },
          totalAmount: { $sum: '$products.totalAmount' } // Sum up the totalAmount field from each product
        }
      },
      {
        $project: {
          _id: 1,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, // Format the date to 'YYYY-MM-DD'
          customer: 1,
          status: 1,
          totalAmount: 1
        }
      },
      {
        $sort: { date: -1 } // Sort by date in descending order
      },
      {
        $limit: 7 // Limit to 7 orders
      }
    ]).toArray();

    // console.log(orders);
    return orders;
  },

  getProducts: async (sellerId) => {
    try {
      console.log(sellerId)
      const products = await db.get().collection(collection.PRODUCT_COLLECTION).find({ seller:ObjectID( sellerId) }).toArray();
      // console.log("products", products);
      return products;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  },  
  deleteProduct: async (productId) => {
    try {
      // Convert the productId to ObjectId
      const objectId = new ObjectID(productId);
      // Delete the product from the database
      const result = await db.get().collection(collection.PRODUCT_COLLECTION)
        .deleteOne({ _id: objectId });
      return result;
    } catch (error) {
      // Handle errors
      console.error('Error deleting product:', error);
      throw error;
    }
  },
  getAllOrders: async () => {
    try {
      const orders = await db.get().collection(collection.ORDER_COLLECTION).find().sort({ _id: -1 }).toArray();
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },
  getLatestOrders: async (limit) => { // Function to get the latest orders with a limit
    try {
      const orders = await db.get().collection(collection.ORDER_COLLECTION)
        .find()
        .sort({ _id: -1 }) // Sort by descending order of _id (assuming _id represents the creation time)
        .limit(limit) // Limit the number of orders
        .toArray();
      return orders;
    } catch (error) {
      console.error('Error fetching latest orders:', error);
      throw error;
    }
  },
  getBanner: async () => {
    try {
        const banners = await db.get().collection(collection.BANNER_COLLECTION).find().toArray();
        return banners;
    } catch (error) {
        console.error('Error fetching banners:', error);
        throw error;
    }
},
addBanner: async (banner) => {
  try {
    const result = await db.get().collection(collection.BANNER_COLLECTION).insertOne(banner);
    return result.ops[0]; // Return the inserted banner object
  } catch (error) {
    console.error('Error adding banner:', error);
    throw error;
  }
},

getProductStock:async (sellerId) => {
  try {
    console.log(sellerId)
      const products = await db
          .get()
          .collection(collection.PRODUCT_COLLECTION)
          .find({ seller: ObjectID(sellerId) }) // Filter products by seller ID
          .toArray();
      return products;
  } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
  }
},
updateProductQuantity: (productId, quantity, sellerId) => {
  return new Promise((resolve, reject) => {
    try {
      // Check if productId and sellerId are valid ObjectId strings
      if (!ObjectID.isValid(productId) || !ObjectID.isValid(sellerId)) {
        throw new Error('Invalid ObjectId');
      }

      const productObjectId = ObjectID(productId);
      const sellerObjectId = ObjectID(sellerId);

      console.log(`Updating quantity for product ${productId} belonging to seller ${sellerId} with quantity ${quantity}`);

      db.get().collection(collection.PRODUCT_COLLECTION).updateOne(
        { _id: productObjectId, seller: sellerObjectId },
        { $set: { quantity: parseInt(quantity) } }
      ).then(() => {
        console.log(`Quantity updated for product ${productId} belonging to seller ${sellerId}`);
        resolve();
      }).catch(error => {
        console.error(`Error updating quantity for product ${productId}:`, error);
        reject(error);
      });
    } catch (error) {
      console.error(`Error updating quantity for product ${productId}:`, error);
      reject(error);
    }
  });
},

getSellerProduct: () => {
  // console.log(sellerId)
  return new Promise((resolve, reject) => {
    db.get().collection(collection.PRODUCT_COLLECTION).find().toArray((err, products) => {
      if (err) {
        reject(err); // Reject the promise if there's an error
      } else {
        resolve(products); // Resolve the promise with the array of products
      }
    });
  });
},
deleteBanner: async (bannerId) => {
  try {
    // Convert the bannerId string to an ObjectId
    const objectId = new ObjectID(bannerId);

    // Delete the banner from the database
    const result = await db.get().collection(collection.BANNER_COLLECTION).deleteOne({ _id: objectId });

    // Check if the deletion was successful
    if (result.deletedCount === 0) {
      throw new Error('Banner not found or already deleted.');
    }

    // Return a success message or any other relevant information
    return { success: true, message: 'Banner deleted successfully.' };

  } catch (error) {
    console.error('Error deleting banner:', error);
    throw error;
  }
},
getTotalProductsCount: async function(searchTerm) {
  try {
    // Construct the search query based on the search term
    let query = {};

    // If searchTerm is not empty, add it to the query
    if (searchTerm) {
        // Case-insensitive partial match for vehicleName
        query = { vehicleName: { $regex: searchTerm, $options: 'i' } };
    }

    // Get the total count of products matching the query
    const totalCount = await db.get().collection(collection.PRODUCT_COLLECTION).countDocuments(query);
    return totalCount;
  } catch (err) {
    throw new Error('Error getting total products count: ' + err.message);
  }
},
getStock: () => {
  return new Promise(async (resolve, reject) => {
    try {
      const products = await db.get().collection(collection.PRODUCT_COLLECTION).find({}).toArray();
      resolve(products);
    } catch (error) {
      reject(error);
    }
  });
},
adminLogin: (userData) => {
  return new Promise(async (resolve, reject) => {
      let response = {};
      let user = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ aname: userData.username });
        if (user) {
          response.user = user
          response.status = true
          resolve(response)
      } else {
          resolve({ status: false })
      }
  });
},
getTopProducts: () => {
  return new Promise((resolve, reject) => {
    db.get().collection(collection.ORDER_COLLECTION)
      .aggregate([
        { $unwind: "$products" }, // Flatten the products array
        { $group: { _id: "$products.productId", totalPurchases: { $sum: 1 } } }, // Group by productId and count total purchases
        { $sort: { totalPurchases: -1 } }, // Sort by total purchases in descending order
        { $limit: 5 } // Limit to top 5 products
      ])
      .toArray()
      .then(async (topProducts) => {
        const promises = topProducts.map(async (product) => {
          const productDetails = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(product._id) });

          if (!productDetails) {
            return {
              _id: product._id,
              name: 'Unknown',
              totalPurchases: product.totalPurchases,
              price: 'Unknown', // Placeholder value for price
            };
          }

          return {
            _id: product._id,
            name: productDetails.vehicleName,
            totalPurchases: product.totalPurchases,
            price: productDetails.price, // Include the price from productDetails
          };
        });

        const resolvedProducts = await Promise.all(promises);
        resolve(resolvedProducts);
      })
      .catch(error => {
        console.error('Error fetching top products:', error);
        reject([]);
      });
  });
},
updateProduct: (productId, updatedProduct, callback) => {
  // Check if updatedProduct is null or undefined
  if (!updatedProduct || typeof updatedProduct !== 'object') {
    console.error('Updated product data is invalid.');
    callback(false);
    return;
  }

  // Convert productId to ObjectId
  const objectId = new ObjectID(productId);
  
  // Update the product in the database
  db.get().collection('product').updateOne({ _id: objectId }, { $set: updatedProduct })
      .then((result) => {
          if (result.modifiedCount > 0) {
              callback(true); // Return true if update successful
          } else {
              console.error('Product not found or no changes applied.');
              callback(false); // Return false if update failed
          }
      })
      .catch((error) => {
          console.error('Error updating product:', error);
          callback(false); // Return false if update failed
      });
},
getProductByIdSeller: (productId, callback) => {
  const objectId = new ObjectID(productId);
  db.get().collection('product').findOne({ _id: objectId })
    .then((product) => {
      if (product) {
        callback(product); // Pass the retrieved product data to the callback
      } else {
        console.error('Product not found.');
        callback(null); // Pass null if product not found
      }
    })
    .catch((error) => {
      console.error('Error fetching product:', error);
      callback(null); // Pass null if an error occurs
    });
}
}