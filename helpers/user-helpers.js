var db = require('../config/connection');
var collection = require('../config/collections');
const bcrypt = require('bcrypt');
const Razorpay = require('razorpay');
const otplib = require('otplib');
const nodemailer = require('nodemailer');
const ObjectID = require('mongodb').ObjectID
var instance = new Razorpay({
    key_id: 'rzp_test_xxcqlCHlsEvoWt',
    key_secret: 'A5R6L88Sr0VYoxG5N4Ygd7f1',
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
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email: userData.username });
            if (user) {
                bcrypt.compare(userData.password, user.password).then((status) => {
                    if (status) {
                        response.user = user
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
    addTocart: async (userId, productId, selectedStore) => {
        try {
            // Check if the user has selected a store
            // if (!selectedStore) {
            //     throw new Error('Please select a store before adding to the cart');
            // }
            // console.log("ProductID"+productId )
            // console.log("userId"+userId )
            // console.log("selectedStore"+selectedStore )


            let product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(productId) });

            // console.log("Product seller: ", JSON.stringify(product));

            let proObj = {
                item: ObjectID(product._id),
                quantity: 1,
                name: product.vehicleName,
                sellingAmount: product.BookingAmount,
                sellerId: ObjectID(product.seller), // Assuming sellerId is the ID of the seller
            };


            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: ObjectID(userId) });

            if (userCart) {
                let prodExit = userCart.products.findIndex(product => product.item.equals(ObjectID(productId)));

                if (prodExit !== -1) {
                    await db.get().collection(collection.CART_COLLECTION)
                        .updateOne(
                            { user: ObjectID(userId), 'products.item': ObjectID(productId) },
                            {
                                $inc: { 'products.$.quantity': 1 },
                            }
                        );
                } else {
                    await db.get().collection(collection.CART_COLLECTION)
                        .updateOne(
                            { user: ObjectID(userId) },
                            {
                                $push: { products: proObj },
                            }
                        );
                }
            } else {
                let cartObj = {
                    user: ObjectID(userId),
                    products: [proObj],
                    selectedStore: selectedStore, // Store the selected store in the cart
                };
                await db.get().collection(collection.CART_COLLECTION).insertOne(cartObj);
            }

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
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
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity',
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product',
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
    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: ObjectID(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity: (details) => {
        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)
        return new Promise((resolve, reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: ObjectID(details.cart) },
                        {

                            $pull: { products: { item: ObjectID(details.product) } }
                        }
                    ).then((response) => {
                        resolve({ removeProduct: true })
                    })
            } else {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: ObjectID(details.cart), 'products.item': ObjectID(details.product) },
                        {
                            $inc: { 'products.$.quantity': details.count }
                        }).then((response) => {
                            resolve({ status: true })
                        })
            }
        })
    },
    deleteProduct: (details) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION)
                .updateOne({ _id: ObjectID(details.cart) },
                    {

                        $pull: { products: { item: ObjectID(details.product) } }
                    }
                ).then((response) => {
                    console.log('remove success')
                    resolve({ removeProduct: true })
                })
        })
    },
    getTotalAmount: (userId) => {
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
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity',
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product',
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
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $multiply: [
                                    { $toDouble: '$quantity' },
                                    { $toDouble: '$product.BookingAmount' }
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
    generateReceiptId: () => {
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
            //  console.log("orders",order);
            //  console.log("Products",products)
            let orderObj = {
                deliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    city: order.city,
                    zipcode: order.zipCode,
                },
                userId: ObjectID(order.userId),
                products: products.map((product) => ({
                    name: product.name,
                    productId: product.item || null,
                    quantity: product.quantity,
                    sellingAmount: product.sellingAmount,
                    date: new Date().toLocaleDateString('en-GB'),
                    receiptId: receiptId,
                    sellerId: product.sellerId,
                    totalAmount: total,
                })),
                sellerId: determineOverallSellerId(products),
            };

            function determineOverallSellerId(products) {
                const distinctSellerIds = Array.from(new Set(products.map((product) => product.sellerId)));

                if (distinctSellerIds.length === 1) {
                    return distinctSellerIds[0];
                } else {
                    // Handle the case when products have different sellerIds (e.g., set to null or a default value)
                    return null;
                }
            }


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
    addProductToCartAndFetch: (userId, productId) => {
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

    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: ObjectID(userId) })
            // console.log(cart.products)
            resolve(cart.products)
        })
    },
    getUserOrder: async (userId) => {
        try {
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
                .aggregate([
                    { $match: { userId: ObjectID(userId) } },
                    { $unwind: "$products" }, // Unwind the products array
                    {
                        $addFields: {
                            "products.dateString": {
                                $cond: {
                                    if: { $isArray: "$products.date" },
                                    then: { $arrayElemAt: ["$products.date", 0] },
                                    else: "$products.date"
                                }
                            } // Convert array to string
                        }
                    },
                    {
                        $addFields: {
                            "products.date": {
                                $dateFromString: {
                                    dateString: "$products.dateString",
                                    format: "%d/%m/%Y" // Assuming date format is day/month/year
                                }
                            }
                        }
                    },
                    { $sort: { "products.date": -1 } }, // Sort products by date in descending order
                    {
                        $group: {
                            _id: "$_id", // Group by order ID
                            deliveryDetails: { $first: "$deliveryDetails" }, // Preserve other fields
                            userId: { $first: "$userId" },
                            products: { $push: "$products" }, // Reconstruct the products array
                            sellerId: { $first: "$sellerId" },
                            status: { $first: "$status" },
                            seller: { $first: "$seller" },
                        }
                    },
                    { $sort: { "products.date": -1 } } // Sort orders by the date of their latest product in descending order
                ])
                .toArray();
    
            // Fetch seller details for each order
            for (let order of orders) {
                if (order.sellerId) {
                    let sellerDetails = await db.get().collection(collection.SELLER_COLLECTION)
                        .findOne({ _id: ObjectID(order.sellerId) });
                    order.shopName = sellerDetails ? sellerDetails.shopName : 'Unknown Shop';
                    order.phoneNumber = sellerDetails ? sellerDetails.phoneNumber : 'Unknown Phone Number';
                    order.NearBy = sellerDetails ? sellerDetails.NearBy : 'Unknown NearBy';
                    order.state = sellerDetails ? sellerDetails.state : 'Unknown State';
                    order.district = sellerDetails ? sellerDetails.district : 'Unknown District';
                    // console.log("sellerDetails",sellerDetails)
                }
            }
    
            // Extract only the date in day/month/year format from the JavaScript date object
            for (let order of orders) {
                for (let product of order.products) {
                    product.date = product.date.toLocaleDateString('en-GB'); // Assuming 'en-GB' locale for day/month/year format
                }
            }
    
            return orders;
        } catch (error) {
            console.error('Error fetching user orders:', error);
            throw error;
        }
    },
    
    
    
    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION)
                .aggregate([
                    {
                        $match: { _id: ObjectID(orderId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    }
                ]).toArray()
            resolve(orderItems)
        })
    },
    cancelOrder: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: ObjectID(orderId) },
                    {
                        $set: {
                            status: 'cancelled'
                        }
                    }).then((response) => {
                        resolve()
                    })
        })
    },
    generateRazorpay: (OrderId, totalPrice) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: totalPrice * 100,  // amount in the smallest currency unit
                currency: "INR",
                receipt: OrderId
            };
            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.error('Error generating Razorpay order:', err);
                    reject(err);
                } else {
                    console.log('Razorpay order generated:', order);
                    resolve(order);
                }
            });
        });
    },
    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha256', 'A5R6L88Sr0VYoxG5N4Ygd7f1');
            const data = `${details['payment[razorpay_order_id]']}|${details['payment[razorpay_payment_id]']}`;

            hmac.update(data);
            const calculatedSignature = hmac.digest('hex');

            // console.log("Details:", details);
            // console.log("Data for HMAC calculation:", data);
            // console.log("Calculated Signature:", calculatedSignature);

            if (calculatedSignature === details['payment[razorpay_signature]']) {
                console.log("Signature matched");
                resolve(true); // Signature matches
            } else {
                console.log("Signature mismatch");
                resolve(false); // Signature does not match
            }
        });
    },
    changeOrderStatus: (orderId, newStatus) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne(
                    { _id: ObjectID(orderId) },
                    { $set: { status: newStatus } }
                )
                .then(() => {
                    resolve();
                })
                .catch((error) => {
                    console.error('Error changing order status:', error);
                    reject(error);
                });
        });
    },
    getStates: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.STATE_COLLECTION).find().toArray()
                .then((states) => {
                    resolve(states)
                })
        })
    },

    getDistrict: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.DISTRICT_COLLECTION).find().toArray()
                .then((districts) => {
                    resolve(districts)
                })
        })
    },

    TotalSale: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let total = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { 'status': { $nin: ['cancelled'] } }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSale: { $sum: '$totalAmount' }
                        }
                    }
                ]).toArray()
                console.log('to sale');
                console.log(total[0]);
                resolve(total[0])
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },


    //===========================Total number of users==================//

    totalUsers: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let totalUsers = await db.get().collection(collection.USER_COLLECTION).count()
                resolve(totalUsers)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    //===========================Total number of users==================//

    totalOrders: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let totalOrders = await db.get().collection(collection.ORDER_COLLECTION).count()
                resolve(totalOrders)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },

    //===========================GET ALL DATE==================//
    // allDate: () => {
    //     return new Promise(async (resolve, reject) => {
    //         let allDate = await db.get().collection(collection.ORDER_COLLECTION)
    //             .aggregate([
    //                 {
    //                     $group: {
    //                         _id: null, day: { $addToSet: "$date" }
    //                     },
    //                 },
    //             ]).toArray()
    //         console.log('alllllllllllllllllllll');
    //         console.log(allDate);

    // let array = allDate[0].day
    // let newdays=[]

    // array.forEach(element =>

    //     newdays.push(element.slice(0,-7))
    // );
    //     console.log(newdays)
    //     })
    // },

    //===========================GET STATUS ACCORDING TO MONTH=====================//

    stausHistory: () => {
        let statuses = {}
        return new Promise(async (resolve, reject) => {
            try {
                let placed = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: {
                            status: 'placed'
                        },
                    },
                    {
                        $group: { _id: { month1: { $month: { $toDate: "$date" } } }, count: { $sum: 1 } }
                    },
                    {
                        $sort: { "_id.month1": -1 }
                    }
                ]).toArray()
                statuses.placedNo = placed[0].count

                try {
                    let delivered = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                        {
                            $match: {
                                status: 'out of delivered'
                            },
                        },
                        {
                            $group: { _id: { month2: { $month: { $toDate: "$date" } } }, count: { $sum: 1 } }
                        }
                    ]).toArray();

                    if (delivered && delivered.length > 0) {
                        statuses.deliveredNo = delivered[0].count;
                    } else {
                        // Handle the case when the delivered array is empty
                        statuses.deliveredNo = 0; // or set it to any default value
                    }
                } catch (error) {
                    // Handle the error appropriately (e.g., log it or throw a meaningful error)
                    console.error("Error fetching delivered orders:", error);
                }


                let cancelled = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: {
                            status: 'cancelled'
                        }
                    },
                    {
                        $group: { _id: { month4: { $month: { $toDate: "$date" } } }, count: { $sum: 1 } }
                    }
                ]).toArray();

                if (cancelled && cancelled.length > 0) {
                    statuses.cancelledNo = cancelled[0].count;
                } else {
                    // Handle the case when the cancelled array is empty
                    statuses.cancelledNo = 0; // or set it to any default value
                }

                console.log(statuses);
                resolve(statuses)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    getOrders2: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let order = await db.get().collection(collection.ORDER_COLLECTION).find().sort({ "date": -1 }).limit(5).toArray()
                console.log('lew');
                console.log(order);
                resolve(order)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    monthlySale: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let monthSale = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { 'status': { $nin: ['cancelled'] } }
                    },
                    {
                        $group: {
                            _id: { month: { $month: { $toDate: "$date" } } }, totalSale: { $sum: '$totalAmount' }
                        }
                    },
                    {
                        $sort: { "_id.month": -1 }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalSale: 1
                        }
                    }
                ]).toArray()
                let month = monthSale[0].totalSale
                console.log(month);
                resolve(month)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    getMonths: () => {
        return new Promise(async (resolve, reject) => {
            // let yearsForCheck=await db.get().collection(collection.ORDER_COLLECTION).aggregate([
            //     {
            //         $group:{
            //             _id: {year:{ $year :{ $toDate: "$date" }}}
            //         }
            //     },
            //     {
            //         $sort:{"_id.year": -1}
            //     },
            //     {
            //         $limit:1
            //     },
            //     {
            //         $project:{
            //             _id:0,year:'$_id.year',
            //         }
            //     }
            // ]).toArray()
            // let check=yearsForCheck[0].year
            // console.log(check)
            // console.log(yearsForCheck);
            try {
                let months = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { 'status': { $nin: ['cancelled'] } }
                    },
                    {
                        $group: {
                            _id: { month: { $month: { $toDate: "$date" } } }, totalSale: { $sum: '$totalAmount' }
                        }
                    },
                    {
                        $sort: { "_id.month": -1 }
                    },
                    {
                        $limit: 6
                    },
                    //orginal
                    {
                        $project: {
                            _id: 0, month: '$_id.month',
                            totalSale: 1,
                        }
                    }

                    //testing
                    // {
                    //     $project:{
                    //         _id:0,month:'$_id.month',               
                    //         totalSale:1,
                    //         qtyEq250: { $eq: [ {year:{ $year :{ $toDate: "$date" }}}, check ] },
                    //         hi:1
                    //     }
                    //}      
                ]).toArray()
                console.log(months);
                months.forEach(element => {
                    // monNumArray.push(element.month)
                    //element.month="hai"

                    function toMonthName(months) {
                        const date = new Date();
                        date.setMonth(months - 1);

                        return date.toLocaleString('en-US', {
                            month: 'long',
                        });
                    }
                    element.month = toMonthName(element.month)
                });
                console.log('m');
                console.log(months);
                resolve(months)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    getYears: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let years = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { 'status': { $nin: ['cancelled'] } }
                    },
                    {
                        $group: {
                            _id: { year: { $year: { $toDate: "$date" } } }, totalSaleYear: { $sum: '$totalAmount' }
                        }
                    },
                    {
                        $sort: { "_id.year": -1 }
                    },
                    {
                        $limit: 6
                    },
                    {
                        $project: {
                            _id: 0, year: '$_id.year',
                            totalSaleYear: 1,
                        }
                    }
                ]).toArray()
                console.log('years');
                console.log(years);
                resolve(years)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    getDays: () => {
        return new Promise(async (resolve, reject) => {
            try {
                let days = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { 'status': { $nin: ['cancelled'] } }
                    },
                    {
                        $group: {
                            _id: { day: { $dayOfMonth: { $toDate: "$date" } } }, totalSaleDay: { $sum: '$totalAmount' }
                        }
                    },
                    {
                        $sort: { "_id.day": -1 }
                    },
                    {
                        $limit: 5
                    },
                    {
                        $project: {
                            _id: 0, day: '$_id.day',
                            totalSaleDay: 1,
                        }
                    }
                ]).toArray()
                console.log('days');
                console.log(days);
                resolve(days)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },

    getOrderUser: (orderId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let users = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { _id: ObjectID(orderId) }
                    },
                    {
                        $lookup: {
                            from: collection.USER_COLLECTION,
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'users'
                        }
                    },
                    {
                        $project: {
                            users: { $arrayElemAt: ['$users', 0] }
                        }
                    }
                ]).toArray()

                // console.log(users.length);
                resolve(users)
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },

    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            try {
                let cartItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match: { _id: ObjectID(orderId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    {
                        $project: {
                            item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                        }
                    }
                ]).toArray()

                console.log(cartItems.length);
                console.log(cartItems);
                // console.log(cartItems[0].products);
                if (cartItems.length === 0) {
                    resolve()
                } else {
                    console.log(cartItems);
                    resolve(cartItems)
                }
            } catch (err) {
                console.log(err);
                reject(err)
            }
        })
    },
    getDistrictByState: (stateId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.DISTRICT_COLLECTION)
                .find({ stateId: stateId })
                .toArray()
                .then((districts) => {
                    resolve(districts);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },

    getDistricts: (State) => {
        return new Promise(async (resolve, reject) => {
            try {
                // console.log('Selected State:', selectedState);

                const districts = await db.get()
                    .collection(collection.DISTRICT_COLLECTION)
                    .find({ state: State })
                    .toArray();

                // console.log("Dis", districts); // Log districts to help debug

                resolve(districts);
            } catch (error) {
                console.error('Error fetching districts:', error);
                reject(error);
            }
        });
    },
    getStores: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.SELLER_COLLECTION)
                .find({})
                .toArray()
                .then((stores) => {
                    resolve(stores);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },

    getProductDetails: (productId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION)
                .findOne({ _id: ObjectID(productId) })
                .then((productDetails) => {
                    resolve(productDetails);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },
    getSellersByStateAndDistrict: (state, district) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.SELLER_COLLECTION)
                .find({ state: state, district: district })
                .toArray()
                .then((sellers) => {
                    resolve(sellers);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },
    getSellersByLocation: (state, district, productId) => {
        return new Promise((resolve, reject) => {
            // console.log("Searching for sellers in:", state, district, productId);
            // Trim the district value to remove trailing spaces
            const trimmedDistrict = district.trim();
            db.get()
                .collection(collection.SELLER_COLLECTION)
                .find({ state: state, district: trimmedDistrict })
                .toArray()
                .then((sellers) => {
                    // console.log('Found sellers:', sellers);
                    if (sellers.length > 0) {
                        // Create an array to collect promises for fetching product details
                        const productPromises = [];

                        sellers.forEach((seller) => {
                            const sellerId = seller._id;
                            // console.log("sellerID", sellerId);

                            // Fetch all products of the seller
                            const productPromise = db.get().collection(collection.PRODUCT_COLLECTION)
                                .find({ seller: ObjectID(sellerId) })
                                .toArray()
                                .then((products) => {
                                    // console.log("Products of seller:", products);
                                    // Check if any product matches the given productId
                                    const matchedProduct = products.find(product => String(product._id) === String(productId));
                                    return !!matchedProduct; // Convert to boolean
                                })
                                .catch((error) => {
                                    console.error('Error fetching products of seller:', error);
                                    return false;
                                });
                            productPromises.push(productPromise);
                        });

                        Promise.all(productPromises)
                            .then((results) => {
                                // Check if any seller has at least one matching product
                                const matchedSellers = sellers.filter((seller, index) => results[index] === true);
                                if (matchedSellers.length > 0) {
                                    resolve(matchedSellers);
                                } else {
                                    console.log('No product found with the matching seller ID.');
                                    resolve(null);
                                }
                            })
                            .catch((error) => {
                                console.error('Error fetching product details:', error);
                                reject(error);
                            });

                    } else {
                        console.log('No sellers found in the specified location.');
                        resolve(null); // No sellers found, resolve with null
                    }
                })
                .catch((error) => {
                    console.error('Error fetching sellers:', error);
                    reject(error);
                });
        });
    },

    getOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(userId)
                let orders = await db.get().collection(collection.ORDER_COLLECTION).findOne({ userId: ObjectID(userId) });
                resolve(orders);
            } catch (error) {
                reject(error);
            }            
        })
    },
    getUserById: (userId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.USER_COLLECTION)
                .findOne({ _id: ObjectID(userId) })
                .then((user) => {
                    resolve(user);
                })
                .catch((error) => {
                    console.error('Error fetching user by ID:', error);
                    reject(error);
                });
        });
    },
    blockUser: async (userId) => {
        try {
            const objectId = new ObjectID(userId); // Convert userId string to ObjectId
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: true } }); // Set isBlocked to true
        } catch (error) {
            console.error('Error blocking user:', error);
            throw error;
        }
    },
    
      unblockUser: async (userId) => {
        try {
            const objectId = new ObjectID(userId);
          await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: false } }); // Set isBlocked to false
        } catch (error) {
          console.error('Error unblocking user:', error);
          throw error;
        }
      },
      generateOTP : (email) => {
        // Create a transporter for sending emails
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'josephalexander283@gmail.com', // Your Gmail email address
                pass: 'ufuw vffi ursz aoyj' // Your Gmail password or an app-specific password
            }
        });
    
        return new Promise((resolve, reject) => {
            const secret = Math.random().toString(36).substring(2, 8); // Generate a random secret
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a random 6-digit OTP
    
            const mailOptions = {
                from: 'josephalexander283@gmail.com',
                to: email,
                subject: 'Your OTP for Login Verification',
                text: `Your OTP is: ${otp}`
            };
    
            // Send OTP via email
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending OTP email:', error);
                    reject(error); // Reject the promise if there's an error sending the email
                } else {
                    console.log('OTP email sent:', info.response);
                    // Set OTP expiration time (30 seconds)
                    setTimeout(() => {
                        reject(new Error('OTP expired'));
                    }, 30 * 1000); // 30 seconds
                    // Resolve with the generated OTP and secret
                    resolve({ otp, secret });
                }
            });
        });
    },
    verifyOTP : async (otp, inputOTP) => {
        try {
            console.log("otp",otp)
            console.log("inputOTP",inputOTP.otp)
            inputOTP = inputOTP.otp;
            // Compare the entered OTP with the inputOTP
            if (otp === inputOTP) {
                console.log('OTP Validation Result: true');
                return true;
            } else {
                console.log('OTP Validation Result: false');
                return false;
            }
        } catch (error) {
            console.error('Error while verifying OTP:', error);
            throw new Error('Error while verifying OTP');
        }
    },
          blockseller: async (sellerId) => {
        try {
            const objectId = new ObjectID(sellerId); // Convert sellerId string to ObjectId
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: true } }); // Set isBlocked to true
        } catch (error) {
            console.error('Error blocking seller:', error);
            throw error;
        }
    },
    
      unblockseller: async (sellerId) => {
        try {
            const objectId = new ObjectID(sellerId);
          await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId }, { $set: { isBlocked: false } }); // Set isBlocked to false
        } catch (error) {
          console.error('Error unblocking seller:', error);
          throw error;
        }
      },
      getProductById: async (productId) => {
        try {
            const product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: ObjectID(productId) });
            return product;
        } catch (error) {
            throw error;
        }
    }
          
        
};