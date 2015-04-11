/* global describe, console, require, before, beforeEach, after, afterEach, it */

/** The explorations of mocha's fundimentals series continues...
  * 
  * This file explores the handling of promises, maximally leveraging what is built into 
  * mocha while minimizing help from other libraries. Turns out mocha-as-promised
  * is not necessary. Seems Mocha version 1.18 is when Promise support was added
  *   http://pascalhertleif.de/artikel/using-promises-more-effectively/
  * Which is why if it() returns Promise, no need for done().
  *
  * And node's build-in assert does just fine for these basic tests.
  *
  * After a bit of research, decided to go with Forbes Lindesay's Promise library:
  *   https://www.npmjs.com/package/promise
  *
  * One can read up on that at https://www.promisejs.org/
  *
  * He also did talks on it:
  *   Forbes Lindesay: Promises and Generators: control flow utopia -- JSConf EU 2013:
  *     https://www.youtube.com/watch?v=qbKWsbJ76-s
  *
  * Install it:
  *   npm install promise --save
  */
describe('promises.js:', function(){
  // Moved all the code into one big file-wide describe to keep JSHint from saying: 
  //   Use the function form of "use strict"
  'use strict'; 

  var assert  = require('assert');
  var http    = require('http');
  var fs      = require('fs');

  // Following Lindesay's style here. I guess the Capital is to imply class-ness? Dunno.
  var Promise = require('promise');

  context('when simply instantiating a Promise', function(){
    var aPromise = null;
    before(function(){
      var threwAsExpected = false;
      try{
        // If no function as first param throws: TypeError: not a function
        //   var aPromise = new Promise();	
        aPromise = new Promise();
        }
      catch(e){
        if( e.name === 'TypeError' && e.message === 'not a function')
	  threwAsExpected = true;
        }
      finally{
        if(!threwAsExpected)
          throw new Error("bad Promise instantiation did not throw as expects");
        }
      aPromise = new Promise(function(){});
      });

    it('should be able to instantiate a Promise, if pass in a function', function(){
      assert(aPromise, 'aPromise is truthy');
      });
    });


  context('when insta-resolving a Promise in before()', function(){
    var bPromise = null;
    before(function(){
      bPromise = Promise.resolve('basically, unit');
      });

    /* Notice how there is no need for a done callback in the params of the function passed in.
     * With a simple (i.e. non-Promise) async callback, that function def would need to function(done){}
     * but because it() returns the Promise synchronously, no done() is needed to handle asynch-ery,
     * yet then() will happen asynchronously. Mocha (as of 1.18, I hear) is tight like that.
     *
     * Here's the most elegant solution from 2014-11 (which must be >= mocha 1.18, I guess):
     *   http://stackoverflow.com/a/26572442
     *   1. No done passed into it()'s callback
     *   2. No rejection handler (could suppress errors)
     *   3. Return the Promise
     *   4. I guess mocha will then() and catch() on it and repsond appropriately
     */
    it('should find in then(), the value supplied earlier during resolve()', function(){
      return bPromise.then(function(aValue){
        assert.equal(aValue, 'basically, unit', 'bPromise insta-resolved like unit');
        });
      });
    });


  /** Playing around with catch() and how mocha interacts with that.
    */
  context('when in before(), insta-resolving a Promise and returning it', function(){
    var aPromise = null;
    before(function(){
      aPromise = Promise.resolve('I\'m in a good mood so OK');
      return aPromise;
      });

    it('should pass without a catch()', function(){
      return aPromise
        .then(function(aValue){
          assert.equal(aValue, 'I\'m in a good mood so OK', 'bPromise insta-resolved like unit');
          });
      });

    it('should still pass even if there is a catch()', function(){
      return aPromise
        .then(function(aValue){
          assert.equal(aValue, 'I\'m in a good mood so OK', 'bPromise insta-resolved like unit');
          })
        .catch(function(aBadThing){
	  console.log('=======================================catch()') ;
          });
      });
    });


  /* -------------- Now let's play with rejected Promises ------------ */


  /** Odd test here. Actually testing mocha, not a SUT so need this to
    * fail for meta-test to be successful.
    *
    * This confirms that if before() returns a promise which rejects, then 
    * it() will never be called, which is good.
    */
  context('when insta-rejecting a Promise in before() the "before all" hook should error. Right here:', function(){
    var aPromise = null;
    before(function(){
      aPromise = new Promise.reject('_this_is_the_reject_reason_string_');
      return aPromise;
      });

    it('should throw bofore it() is called', function(){
      return aPromise.then(function(aValue){
        assert.fail('', '', 'aPromise should have rejected and mocha should have detected that such that this it() should never have been reached.', '');
        });
      });
    });


  /** Just checking that indeed an _async_ reject in before() will prevent it() from being called */
  context('when setTime() rejects a Promise that was returned from before(), it() should never get called', function(){
    var aPromise = null;
    before(function(){
      aPromise = new Promise(function(resolve, reject){
        setTimeout(function(){reject('Intentionally timed out and rejected');}, 500);
        });
      return aPromise;
      });

    it('should throw before it() gets called', function(){
      return aPromise.then(function(aValue){
        assert.fail('', '', 'aPromise should have rejected in before and this it() should never have been called', '');
        });
      });
    });


  /* If a Promise has a catch() and it rejects then that cathc() is
   * supposed to be given a chance to eat the reject message that
   * would otherwise go to mocha. That catch()/rejectHandler can
   * itself throw; that is one way how to say "derp, I can't handle
   * this".
   */
  context('when insta-rejecting a Promise in it()', function(){
    var aPromise = null;
    before(function(){
      /* Normally I like to do set-up of state in before(), not it().
       * But this is a this test of mocha, rather than a SUT, so
       * cannot do the normal structure because want to test a
       * rejected Promise. As was just shown in previous test, a
       * Promise rejected in before() will prevent it() from ever
       * getting called. So, will reject in it() in this situation.
       */
      });

    it('should fail if there is no catch()', function(){
      aPromise = Promise.reject('Not feeling it');
      return aPromise
        .then(function(aValue){
          assert.fail('', '', 'aPromise should have rejected, so this then() should never have been called', '');
          });
      });

    /* This case is interesting: a catch() will prevent mocha from
     * calling this a failed test, as per the design of Promises. For
     * testing purposes I guess that makes sense and is how Promises
     * are supposed to work. I.e. mocha is probably doing a catch()
     * on the returned Promise. If this catch takes care of the
     * problem then mocha's catch() should not be called.
     */
    it('should pass as this catch() "handles" the rejection', function(){
      aPromise = Promise.reject('I\'m in a bad mood so NO');
      return aPromise
        .then(function(aValue){
          assert.fail('', '', 'aPromise should have rejected in before and this it() should never have been called', '');
          })
        .catch(function(aBadThing){
	  // silently "handle" the rejection
          });
      });

    it('should fail since this catch() throws intentionally', function(){
      aPromise = Promise.reject('I\'m in a bad mood so NO');
      return aPromise
        .then(function(aValue){
          assert.fail('', '', 'aPromise should have rejected; this it() should never have been called', '');
          })
        .catch(function(aBadThing){
	  throw new Error(aBadThing);
          });
      });
    });
  });

