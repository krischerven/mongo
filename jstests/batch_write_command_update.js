//
// Ensures that mongod respects the batch write protocols for updates
//

var coll = db.getCollection( "batch_write_update" );
coll.drop();

jsTest.log("Starting update tests...");

var request;
var result;

function resultOK( result ) {
    return result.ok &&
           !( 'code' in result ) &&
           !( 'errmsg' in result ) &&
           !( 'errInfo' in result ) &&
           !( 'errDetails' in result );
};

function resultNOK( result ) {
    return !result.ok &&
           typeof( result.code ) == 'number' &&
           typeof( result.errmsg ) == 'string';
};

// EACH TEST BELOW SHOULD BE SELF-CONTAINED, FOR EASIER DEBUGGING

//
// NO DOCS, illegal command
coll.remove({});
printjson( request = {update : coll.getName()} );
printjson( result = coll.runCommand(request) );
assert(resultNOK(result));

//
// Single document upsert, no write concern specified
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {a:1}}, upsert:true}]} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(1, result.n);
assert( 'upserted' in result );
// Count the upserted doc
assert.eq(1, coll.count({_id: result.upserted}));

//
// Single document upsert, write concern specified, no ordered specified
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {a:1}}, upsert:true}],
                      writeConcern: {}} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(1, result.n);
assert( 'upserted' in result );
// Count the upserted doc
assert.eq(1, coll.count({_id: result.upserted}));

//
// Single document upsert, write concern specified, ordered = true
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {a:1}}, upsert:true}],
                      writeConcern: {},
                      ordered:true} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(1, result.n);
assert( 'upserted' in result );
// Count the upserted doc
assert.eq(1, coll.count({_id: result.upserted}));

//
// Single document upsert, write concern 0 specified, ordered = true
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {a:1}}, upsert:true}],
                      writeConcern: {w:0},
                      ordered:true} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(1, result.n);
assert( 'upserted' in result );
// Count the upserted doc
assert.eq(1, coll.count({_id: result.upserted}));

//
// Two document upsert, write concern 0 specified, ordered = true
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:2}, u: {$set: {a:1}}, upsert:true},
                                {q:{a:2}, u: {$set: {a:2}}, upsert:true}],
                      writeConcern: {w:0},
                      ordered:true} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(2, result.n);
assert(!('upserted' in result));
assert.eq(2, coll.count());

//
// Single document update
coll.remove({});
coll.insert({a:1});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {c:1}}}],
                      writeConcern: {w:1}} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(1, result.n);
assert(!('upserted' in result));
assert.eq(1, coll.count());

//
// Multi document update/upsert
coll.remove({});
coll.insert({b:1});
printjson( request = {update : coll.getName(),
                      updates: [{q:{b:1}, u: {$set: {b:1, a:1}}, upsert:true},
                                {q:{b:2}, u: {$set: {b:2, a:1}}, upsert:true}],
                      writeConcern: {w:1},
                      ordered:false} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(2, result.n);

assert.eq(1, result.upserted.length);
assert.eq(1, result.upserted[0].index);
assert.eq(1, coll.count({_id: result.upserted[0]._id}));
assert.eq(2, coll.count());

//
// Multiple document update
coll.remove({});
coll.insert({a:1});
coll.insert({a:1});
printjson( request = {update : coll.getName(),
                      updates: [{q:{a:1}, u: {$set: {c:2}}, multi:true}],
                      writeConcern: {w:1},
                      ordered:false} );
printjson( result = coll.runCommand(request) );
assert(resultOK(result));
assert.eq(2, result.n);
assert.eq(2, coll.find({a:1, c:2}).count());
assert.eq(2, coll.count());

//
//
// Unique index tests
coll.remove({});
coll.ensureIndex({a : 1}, {unique : true});

//
// Upsert fail due to duplicate key index, w:0, ordered:true
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{b:1}, u: {$set: {b:1, a:1}}, upsert:true},
                                {q:{b:2}, u: {$set: {b:2, a:1}}, upsert:true}],
                      writeConcern: {w:0},
                      ordered:true} );
printjson( result = coll.runCommand(request) );
printjson( coll.find().toArray() );
assert(resultNOK(result));
assert.eq(1, result.n);
assert(!('upserted' in result));
assert.eq(1, coll.count());

//
// Upsert fail due to duplicate key index, w:1, ordered:true
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{b:1}, u: {$set: {b:1, a:1}}, upsert:true},
                                {q:{b:3}, u: {$set: {b:3, a:2}}, upsert:true},
                                {q:{b:2}, u: {$set: {b:2, a:1}}, upsert:true}],
                      writeConcern: {w:1},
                      ordered:true} );
printjson( result = coll.runCommand(request) );
assert(resultNOK(result));
assert.eq(2, result.n);
assert.eq(1, result.errDetails.length);

assert.eq(2, result.errDetails[0].index);
assert.eq('number', typeof result.errDetails[0].code);
assert.eq('string', typeof result.errDetails[0].errmsg);

assert.eq(2, result.upserted.length);
assert.eq(0, result.upserted[0].index);
assert.eq(1, coll.count({_id: result.upserted[0]._id}));

assert.eq(1, result.upserted[1].index);
assert.eq(1, coll.count({_id: result.upserted[1]._id}));

//
// Upsert fail due to duplicate key index, w:1, ordered:false
coll.remove({});
printjson( request = {update : coll.getName(),
                      updates: [{q:{b:1}, u: {$set: {b:1, a:1}}, upsert:true},
                                {q:{b:2}, u: {$set: {b:2, a:1}}, upsert:true},
                                {q:{b:2}, u: {$set: {b:2, a:1}}, upsert:true},
                                {q:{b:3}, u: {$set: {b:3, a:3}}, upsert:true}],
                      writeConcern: {w:1},
                      ordered:false} );
printjson( result = coll.runCommand(request) );
assert(resultNOK(result));
assert.eq(2, result.n);
assert.eq(2, result.errDetails.length);

assert.eq(1, result.errDetails[0].index);
assert.eq('number', typeof result.errDetails[0].code);
assert.eq('string', typeof result.errDetails[0].errmsg);

assert.eq(2, result.errDetails[1].index);
assert.eq('number', typeof result.errDetails[1].code);
assert.eq('string', typeof result.errDetails[1].errmsg);

assert.eq(2, result.upserted.length);
assert.eq(0, result.upserted[0].index);
assert.eq(1, coll.count({_id: result.upserted[0]._id}));

assert.eq(3, result.upserted[1].index);
assert.eq(1, coll.count({_id: result.upserted[1]._id}));
