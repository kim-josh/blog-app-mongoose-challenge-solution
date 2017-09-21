const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');
const should = chai.should();
const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function generateBlogData() {
  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()  
    },
    title: faker.lorem.words(),
    content: faker.lorem.paragraphs(),
  }
}

function seedBlogData() {
  console.info('Seeding blog data');
  const seedData = [];
  for (let i = 1; i <= 10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise 
  return BlogPost.insertMany(seedData);
}

function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('Blog API resource', function() {
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });
  beforeEach(function() {
    return seedBlogData();
  });
  afterEach(function() {
    return tearDownDb();
  });
  after(function() {
    return closeServer();
  });

  // Strategy: Retrieve all posts from GET, but should include correct keys
  // Get id from one of them to make sure
  // Make sure that the values in the posts correspond with those in the database
  describe('GET endpoint', function() {
    it('should return posts with the correct fields', function() {
      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);
          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys('id', 'author', 'content', 'title', 'created');
          });
          resPost = res.body[0];
          return BlogPost.findById(resPost.id);
        })
        .then(function(post) {
          resPost.id.should.equal(post.id);
          resPost.author.should.equal(post.authorName);
          resPost.content.should.equal(post.content);
          resPost.title.should.equal(post.title);
        });
    });
  });

  // Strategy: prove that the post we get back has the correct keys
  // id should be there as well, indicating that the data was inserted into db
  // New post from the DB should equal to the post sent over
  describe('POST endpoint', function() {
    it('should add a new blog post', function() {
      const newPost = generateBlogData();
      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys('id', 'author', 'content', 'title', 'created');
          res.body.id.should.not.be.null;
          res.body.author.should.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);
          res.body.content.should.equal(newPost.content);
          res.body.title.should.equal(newPost.title);
          return BlogPost.findById(res.body.id);
        })
        .then(function(post) {
          post.author.firstName.should.equal(newPost.author.firstName);
          post.author.lastName.should.equal(newPost.author.lastName);
          post.content.should.equal(newPost.content);
          post.title.should.equal(newPost.title);
        });
    });
  });

  // Strategy: create an object with data we want to update and then
  // retrieve existing post and set both id equal to each other
  // Need to make sure the post got correctly updated with the id and status code
  describe('PUT endpoint', function() {
    it('should update blog posts', function() {
      const updatePost = {
        title: "500 Days of Winter",
        content: "Lorem Ipsum",
        author: {
          firstName: "Kendrick",
          lastName: "Lamar"
        }
      };
      return BlogPost
        .findOne()
        .then(function(post) {
          updatePost.id = post.id;
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updatePost)
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(updatePost.id)
        })
        .then(function(post) {
          post.title.should.equal(updatePost.title);
          post.content.should.equal(updatePost.content);
          post.author.firstName.should.equal(updatePost.author.firstName);
          post.author.lastName.should.equal(updatePost.author.lastName);
        });
    });
  });

  // Strategy: Retrieve a restaurant, delete it, and 
  // check that it is no longer in db
  describe('DELETE endpoint', function() {
    it('should delete blog posts', function() {
      let post;
      BlogPost
        .findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          should.not.exist(_post);
        });
    });
  });
});