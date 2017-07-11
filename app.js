(function () {

    const sqrObjRecursive = (obj) => {
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object') obj[key] = sqrObjRecursive(obj[key]);
            else obj[key] = obj[key] * obj[key]
        }); console.log(obj);
        return obj;
    };

    /// Firebase area
    // Initialize Firebase
    var config = {
        apiKey: "AIzaSyB6jZToAkQXpySSQ4omQ7SKP23TQUQDF8M",
        authDomain: "sd-blog-c1b48.firebaseapp.com",
        databaseURL: "https://sd-blog-c1b48.firebaseio.com",
        projectId: "sd-blog-c1b48",
        storageBucket: "sd-blog-c1b48.appspot.com",
        messagingSenderId: "896841901128"
    };

    firebase.initializeApp(config);

    // Auth
    var provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider).then(function (result) {
        // This gives you a Google Access Token. You can use it to access the Google API.
        var token = result.credential.accessToken;
        // The signed-in user info.
        var user = result.user;
        // ...
    }).catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // The email of the user's account used.
        var email = error.email;
        // The firebase.auth.AuthCredential type that was used.
        var credential = error.credential;
        // ...
    });

    /// - Global class setup for apps
    /// https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Classes
    /// http://justinfagnani.com/2015/12/21/real-mixins-with-javascript-classes/
    // Mixin maker
    let mix = (superclass) => new MixinBuilder(superclass);

    class MixinBuilder {

        constructor(superclass) {
            this.superclass = superclass;
        }

        // (spread operator, will pass everything from 0 to n)
        with(...mixins) {
            return mixins.reduce((c, mixin) => mixin(c), this.superclass);
        }

    }

    // Mixins
    let FirebaseController = (superclass) => class extends superclass {

        writeNewPost(data) {

            let database = firebase.database();

            // A post entry.
            var postData = {
                guid: data.guid,
                body: data.body,
                title: data.title,
                date: data.date
            };

            // Get a key for a new Post.
            var newPostKey = database.ref().child('posts').push().key;

            // Write the new post's data simultaneously in the posts list and the user's post list.
            var updates = {};
            updates['/posts/' + newPostKey] = postData;

            return database.ref().update(updates);

        }

        queryFirebase(id, cb, ctx) {

            if (typeof cb != 'function')
                throw ":- Callback expected.";

            ctx = ctx ? ctx : this;

            let ref = firebase.database().ref(id).limitToLast(100);

            ref.once('value', function (snap) {

                let list = [];

                snap.forEach(function (d) {
                    list.push(d.val());
                });

                cb.call(ctx, list);

            });

            // test.on('child_added', function (data) {
            //     console.log(data.val());
            // });

        }

    };

    let Collection = (superclass) => class extends superclass {

        get(id) {
            return this.data.find(x => x.id === id);
        }

        add(data) {
            this.data.push(data);
        }

        set(id, prop, val) {
            let d = this.Get(id);
            if (d && d[prop]) d[prop] = val;
        }

    };

    let Fetcher = (superclass) => class extends superclass {

        query(url, cb, ctx) {

            if (typeof cb != 'function')
                throw ":- Callback expected.";

            ctx = ctx ? ctx : this;
            return fetch(url)
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    return cb.call(ctx, data);
                });

        }

    };

    // Helpers
    class Helpers {

        static guid() {
            return (function guid() {
                function s4() {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                }
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                    s4() + '-' + s4() + s4() + s4();
            })();
        }

    }

    class ArrayHelpers {

        static shuffle(a) {
            for (let i = a.length; i; i--) {
                let j = Math.floor(Math.random() * i);
                [a[i - 1], a[j]] = [a[j], a[i - 1]];
            }
            return a;
        }

        static sort(a, b, type) {
            type = type ? type : "desc";
            return type === "desc" ? b - a : a - b;
        }

        static objToArray(obj) {
            return Object.keys(obj).map(function (e) {
                return [Number(e), obj[e]];
            });
        }

    }

    // External markdown formatting (needs more research as this would be better as a helper)
    // https://github.com/showdownjs/showdown
    // https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet
    let Formatter = new showdown.Converter();

    /// - Custom stuff for individual app
    // Some base class for handling post collections
    class PostCollective {

        constructor() {
            this.data = ko.observableArray();
            this.formatter = new showdown.Converter();
        }

        addPost(data) {
            this.add(new Post(data));
            return this;
        }

        addPosts(data) {
            for (let i = 0; i < data.length; i++) {
                this.addPost(data[i]);
            }
            return this;
        }

        sortByDate(type) {
            this.data.sort((a, b) => ArrayHelpers.sort(a.date(), b.date(), type));
            return this;
        }

    }

    // A nice post class (knockoutjs enabled)
    class Post {

        constructor(data) {
            this.guid = ko.observable(data.guid);
            this.title = ko.observable(data.title);
            this.body = ko.observable(data.body);
            this.formattedBody = ko.computed(function () {
                return Formatter.makeHtml(this.body());
            }, this);
            this.date = ko.observable(data.date);
            //this.tags = tags;
            //this.category = category;
            // For routing in data
            //this.url = ko.observable("/" + data.category + "/" + data.title);
        }

    }

    // Some amazing post collection class (you might not want your 'fetcher' being used by the posts however, it looks a little strange)
    class Posts extends mix(PostCollective).with(Collection, Fetcher, FirebaseController) {
        // I have access to both the prototypal method above, and the other 'useful' bits in the mixins <3
    }

    // Make it happen
    let thePosts = new Posts();

    // UI Bit
    let viewModel = {
        postTitle: ko.observable(""),
        postBody: ko.observable(""),
        posts: thePosts.data,
        savePost: function (ctx, e) {

            let pk = {
                "guid": Helpers.guid(),
                "title": this.postTitle(),
                "body": this.postBody(),
                "date": new Date().getTime()
            };

            if (pk.title.length === 0 || pk.body.length === 0)
                return;

            thePosts
                .addPost(pk)
                .writeNewPost(pk);

            thePosts.sortByDate();

        }
    };

    ko.applyBindings(viewModel);

    // Query some more posts test (obviously would optimize)
    thePosts.queryFirebase('posts', function (res) {
        thePosts
            .addPosts(res)
            .sortByDate();
    });

})();