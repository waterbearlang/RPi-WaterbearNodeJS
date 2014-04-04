 var makeapi = require('makeapi-client')({
     apiURL: "http://localhost:5000",
     hawk: {
         key: "00000000-0000-0000-000000000000",
         id: "00000000-0000-0000-000000000000"
     }
 });

 exports.createMake = function(req, res) {

     makeapi.create({
         maker: req.body.email,
         make: req.body
     }, function(err, newMake) {
         if (err) {
             //console.log(err);
             res.send(400, {
                 error: 'Failed to create make'
             });
         } else {
             //console.log(newMake);
             res.send(200);
         }
     });
 }

 exports.deleteMake = function(req, res) {

     var makeId = req.params.id;

     if (!makeId) {
         res.send(400, {
             error: 'Invalid make ID'
         });
     }

     makeapi.delete(
         makeId,
         function(err, deletedMake) {
             if (err) {
                 res.send(400, {
                     error: 'Failed to delete make' + makeId
                 });
             } else {
                 res.send(200);
             }
         }
     )
 }

 exports.updateMake = function(req, res) {

     var makeId = req.params.id;
     var make = req.body;

     if (!makeId) {
         res.send(400, {
             error: 'Invalid make ID'
         });
     }

     makeapi.update(
         makeId,
         make,
         function(err, updatedMake) {
             if (err) {
                 res.send(400, {
                     error: 'Failed to update make' + makeId
                 });
             } else {
                 res.send(200);
             }
         }
     )
 }