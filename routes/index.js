var express = require('express');
const axios = require('axios');
var router = express.Router();
var Cart = require('../models/cart');

var Product = require('../models/product');
var Order = require('../models/order');

var mcache = require('memory-cache');

var cache = (duration) => {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body)
      }
      next()
    }
  }
}


/* GET home page. */
router.get('/', function (req, res, next) {
    var successMsg = req.flash('success')[0];
    var response;
    Product.find(function (err, docs) {
      if (req.session.cart) {
        var cart = new Cart(req.session.cart);
        response =  {title: 'Shopping Cart', products: docs, sessionCart: cart.generateArray(), totalPrice: cart.totalPrice, successMsg: successMsg, noMessages: !successMsg};
      } else {
         response = {title: 'Shopping Cart', products: docs, sessionCart: null, totalPrice: null, successMsg: successMsg, noMessages: !successMsg};
      }
       //cart
       //
        res.render('shop/index',response);
    });
});

router.get('/add-to-cart/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productId, function(err, product) {
       if (err) {
           return res.redirect('/');
       }
        cart.add(product, product.id);
        req.session.cart = cart;
        console.log(req.session.cart);
        res.redirect('/');
    });
});

router.get('/reduce/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.reduceByOne(productId);
    req.session.cart = cart;
    res.redirect('/');
});

router.get('/remove/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.removeItem(productId);
    req.session.cart = cart;
    res.redirect('/');
});
router.post('/remove/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});
    cart.removeItem(productId);
    req.session.cart = cart;
    console.log('update', req.session.cart);
    res.send({status:'success', totalPrice: cart.totalPrice});
});


router.post('/update/:id', function(req, res, next) {
    var productId = req.params.id;
    var qty =  parseInt(req.body.qty);
    var cart = new Cart(req.session.cart ? req.session.cart : {});
    Product.findById(productId, function(err, product) {
      var totalUnit = cart.updateItem(productId, qty , product );
      req.session.cart = cart;
      console.log(cart);
      res.send({status:'success', totalPrice: cart.totalPrice, totalUnit: totalUnit });
    });
});

router.get('/shopping-cart', function(req, res, next) {
   if (!req.session.cart) {
       return res.render('shop/shopping-cart', {products: null});
   }
    var cart = new Cart(req.session.cart);
    res.render('shop/shopping-cart', {checkout: true, products: cart.generateArray(), totalPrice: cart.totalPrice});
});

router.post('/cart', function(req, res, next) {
   var data = [];
   var flag = true;
   requiredFields = ['nome' ,'sobrenome', 'cpf', 'telefone', 'email', 'telefone', 'cep', 'endereco','numero', 'bairro', 'cidade','estado'];
   requiredFields.forEach((value, index) => {
     if(req.body[value] == ''){
       data.push({inputerror: value, error_string: 'Por favor, preencha este campo.'});
       flag = false;
     }
   });

   if(req.body.cep.length < 8  || (isNaN(parseFloat(req.body.cep)) && !isFinite(req.body.cep) ) ){
     data.push({inputerror: 'cep', error_string:'Por favor, este campo deve conter 8 caracteres númericos.'});
     flag = false;
   }

   if(!req.body.frete){
     data.push({inputerror: 'frete', error_string: 'Por favor, preencha este campo.'});
     flag = false;
   }
   if(flag === true){
     return res.send({status: true});
   } else {
     return res.send(data);
   }
});

xml = require('jstoxml');

req = require('request');

var caralho = (cart) => {
return new Promise(
  function(resolve, reject){
  var pag, pagseguro;
  pagseguro = require('pagseguro');
   pag = new pagseguro({
       email : 'analista@visualmode.com.br',
       token: '07921C2E8097427A8380818AEC54D0DC',
       mode : 'sandbox'
   });
   pag.currency('BRL');
   pag.reference('12345');

  cart.generateArray().forEach((value, index) => {
     pag.addItem({
         id: index + 1,
         description: value.item.title,
         amount:  (value.price / value.qty).toFixed( 2 ),
         quantity: value.qty,
         weight: 1
     });
   });

   pag.buyer({
        name: 'José Comprador',
        email: 'c87394812323892333558@sandbox.pagseguro.com.br',
        phoneAreaCode: '51',
        phoneNumber: '12345678',
    });

    pag.shipping({
        type: 1,
        street: 'Rua Alameda dos Anjos',
        number: '367',
        complement: 'Apto 307',
        district: 'Parque da Lagoa',
        postalCode: '01452002',
        city: 'São Paulo',
        state: 'RS',
        country: 'BRA'
    });
    pag.send(function(err, res) {
    if (err) {
        reject(err);
    }
    var parseString = require('xml2js').parseString;
      parseString(res, function (err, result) {
          //console.log(JSON.stringify(result));
          //resolve('');
          resolve(result.checkout.code);
      });
    });

  });
}
router.get('/checkout', function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    var errMsg = req.flash('error')[0];
    caralho(cart).then((code) => {
      res.render('shop/checkout', {total: cart.totalPrice, errMsg: errMsg, noError: !errMsg, code: code });

    });
});
router.get('/processado/:code/:newTransaction', (req, res) => {
  res.send("Tudo certo, código da transação: " + req.params.code);
});
router.post('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);

    var stripe = require("stripe")(
        "sk_test_fwmVPdJfpkmwlQRedXec5IxR"
    );

    stripe.charges.create({
        amount: cart.totalPrice * 100,
        currency: "usd",
        source: req.body.stripeToken, // obtained with Stripe.js
        description: "Test Charge"
    }, function(err, charge) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('/checkout');
        }
        var order = new Order({
            user: req.user,
            cart: cart,
            address: req.body.address,
            name: req.body.name,
            paymentId: charge.id
        });
        order.save(function(err, result) {
            req.flash('success', 'Successfully bought product!');
            req.session.cart = null;
            res.redirect('/');
        });
    });
});

module.exports = router;

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.oldUrl = req.url;
    res.redirect('/user/signin');
}
