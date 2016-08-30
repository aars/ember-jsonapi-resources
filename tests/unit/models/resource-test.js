import { moduleFor, test } from 'ember-qunit';
import Ember from 'ember';
import RSVP from 'rsvp';
import Resource from 'ember-jsonapi-resources/models/resource';
import { attr } from 'ember-jsonapi-resources/models/resource';
import { setup, teardown, mockServices } from 'dummy/tests/helpers/resources';

moduleFor('model:resource', 'Unit | Model | resource', {
  beforeEach() {
    setup.call(this);
    mockServices.call(this);
    let owner = this.container;
    this.sandbox = window.sinon.sandbox.create();
    this.registry.register('model:resource', Resource, { instantiate: false });
    this._ogSubject = this.subject;
    this.subject = function(options) {
      let Factory = owner.lookup('model:resource');
      Factory = Factory.extend({type: 'resource'});
      return Factory.create(options);
    };
  },
  afterEach() {
    teardown();
    this.sandbox.restore();
    this.registry.unregister('model:resource');
    this.subject = this._ogSubject;
  }
});

test('it creates an instance, default flag for isNew is false', function(assert) {
  let resource = this.subject();
  assert.ok(!!resource);
  assert.equal(resource.get('isNew'), false, 'default value for isNew flag set to `false`');
});

test('#toString method', function(assert) {
  let resource = this.subject();
  let stringified = resource.toString();
  assert.equal(stringified, '[JSONAPIResource|resource:null]', 'resource.toString() is ' + stringified);
  resource.setProperties({id: '1', type: 'posts'});
  stringified = resource.toString();
  assert.equal(stringified, '[JSONAPIResource|post:1]', 'resource.toString() is ' + stringified);
});

test('it has the same attributes as JSON API 1.0 Resource objects', function(assert) {
  let resource = this.subject();
  let attrs = Ember.String.w('type id attributes relationships links meta');
  attrs.forEach(function (attr) {
    var val = resource.get(attr);
    assert.notStrictEqual(val, undefined, attr + ' is `'+ val +'` not undefined');
  });
});

test('it has methods to add/remove relationships', function(assert) {
  let resource = this.subject();
  let methods = Ember.String.w('addRelationship removeRelationship');
  methods.forEach(function (method) {
    assert.ok(typeof resource[method] === 'function', 'resource#' + method + ' is a function');
  });
});

test('it has properties for changed/previous attributes', function(assert) {
  let resource = this.subject();
  let attrs = Ember.String.w('changedAttributes previousAttributes');
  attrs.forEach(function (attr) {
    var val = resource.get(attr);
    assert.notStrictEqual(val, undefined, attr + ' is `'+ val +'` not undefined');
  });
});

test('it needs a reference to an injected service object', function(assert) {
  let resource = this.subject();
  assert.ok(resource.get('service') === null, 'resource#service is null by default');
});

test('attr() uses the attributes hash for computed model attributes', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  assert.equal(post.get('title'), 'Wyatt Earp', 'name is set to "Wyatt Earp"');
  assert.equal(post.get('excerpt'), 'Was a gambler.', 'excerpt is set to "Was a gambler."');

  assert.equal(post.get('attributes.title'), 'Wyatt Earp');
  assert.equal(post.get('attributes.excerpt'), 'Was a gambler.');
});

test('attr() helper creates a computed property using a unique (protected) attributes hash', function(assert) {
  const Factory = this.container.lookup('model:resource');
  const PersonFactory = Factory.extend({ name: attr('string'), type: 'person' });

  let personA = PersonFactory.create({ attributes: { 'name': 'Ricky' }});
  assert.equal(personA.get('name'), 'Ricky', 'personA name is set to Ricky');

  let personB = PersonFactory.create();
  assert.equal(personB.get('name'), undefined, 'personB name is NOT set to Ricky');

  let personC = PersonFactory.create({ attributes: { 'name': 'Lucy' }});
  assert.equal(personC.get('name'), 'Lucy', 'personC name is set to Lucy');

  let personD = PersonFactory.create();
  assert.equal(personD.get('name'), undefined, 'personD name is NOT set to Lucy');

  const Actor = PersonFactory.extend({ show: attr(), type: 'person' });
  let lilRicky = Actor.create({ attributes: { 'name': 'Ricky Jr', 'show': 'I love Lucy' } });
  assert.equal(lilRicky.get('name'), 'Ricky Jr', 'lilRicky name is set to Ricky Jr');

  let otherLilRicky = Actor.create();
  assert.equal(otherLilRicky.get('name'), undefined, 'otherLilRicky name is NOT set to Ricky Jr');
});

test('#changedAttributes', function(assert) {
  let post = this.container.lookup('model:post').create({
    attributes: {id: '1', title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  assert.equal(post.get('excerpt'), 'Was a gambler.', 'excerpt is set "Was a gambler."');
  post.set('excerpt', 'Became a deputy.');
  assert.equal(post.get('excerpt'), 'Became a deputy.', 'excerpt is set to "Became a deputy."');

  let changed = post.get('changedAttributes');
  assert.equal(Object.keys(changed).join(''), 'excerpt', 'changed attributes include only excerpt');
  assert.equal(changed.excerpt, 'Became a deputy.', 'change excerpt value is "Became a deputy."');
});

test('#previousAttributes', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  assert.equal(post.get('excerpt'), 'Was a gambler.', 'excerpt is set to "Was a gambler."');
  post.set('excerpt', 'Became a deputy.');
  assert.equal(post.get('excerpt'), 'Became a deputy.', 'excerpt is set to "Became a deputy."');

  let previous = post.get('previousAttributes');
  assert.equal(Object.keys(previous).join(''), 'excerpt', 'previous attributes include only excerpt');
  assert.equal(previous.excerpt, 'Was a gambler.', 'previous excerpt value is "Was a gambler."');
});

test('#rollback resets attributes based on #previousAttributes', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  assert.equal(post.get('excerpt'), 'Was a gambler.', 'excerpt is set to "Was a gambler."');
  post.set('excerpt', 'Became a deputy.');
  assert.equal(post.get('excerpt'), 'Became a deputy.', 'excerpt is set to "Became a deputy."');
  let previous = post.get('previousAttributes');
  assert.equal(previous.excerpt, 'Was a gambler.', 'previous excerpt value is "Was a gambler."');
  assert.equal(Object.keys(previous).length, 1, 'previous attribues have one change tracked');

  post.rollback();

  previous = post.get('previousAttributes');
  assert.equal(post.get('excerpt'), 'Was a gambler.', 'excerpt is set to "Was a gambler."');
  assert.equal(Object.keys(previous).length, 0, 'previous attribues are empty');
});

test('#didUpdateResource empties the resource _attributes hash when resource id matches json arg id value', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  post.set('excerpt', 'became a deputy.');
  assert.equal(Object.keys(post.get('_attributes')).length, 1, 'one changed attribute present before didUpdateResource called');
  post.didUpdateResource({id: '1'});
  assert.equal(Object.keys(post.get('_attributes')).length, 0, 'no changed attribute present after didUpdateResource called');
});

test('#didUpdateResource does nothing if json argument has an id that does not match the resource id', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  post.set('excerpt', 'became a deputy.');
  assert.equal(Object.keys(post.get('_attributes')).length, 1, 'one changed attribute present before didUpdateResource called');
  post.didUpdateResource({id: 'not-1'});
  assert.equal(Object.keys(post.get('_attributes')).length, 1, 'one changed attribute still present after didUpdateResource called');
});

test('#addRelationship', function(assert) {
  // create resource with relation from json payload.
  let comment = this.container.lookup('model:comment').create({
    id: '4',  attributes: {body: 'Wyatt become a deputy too.' },
    relationships: { commenter: { data: { type: 'commenter', id: '3' } } }
  });
  let commenterRelation = {links: {}, data: {type: 'commenter', id: '3'}};
  assert.deepEqual(comment.get('relationships').commenter,
                   commenterRelation,
                  'created comment with commenter relationship from json payload');

  // create resource and add relationships through .addRelationship()
  // make sure both relationships exist after manipulation.
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  post.addRelationship('author', '2');
  let authorRelation = {links: {}, data: {type: 'authors', id: '2'}};
  post.addRelationship('comments', '4');
  let commentsRelation = {links: {}, data: [{type: 'comments', id: '4'}]};
  assert.deepEqual(post.get('relationships').author,
                   authorRelation,
                   'added author relationship to post');
  assert.deepEqual(post.get('relationships').comments,
                   commentsRelation,
                   'added relationship for comment to post');
});

test('#removeRelationship', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'},
    relationships: {
      author: { data: { type: 'authors', id: '2' }, links: { related: ''} },
      comments: { data: [{ type: 'comments', id: '4' }], links: { related: ''} }
    }
  });
  let author = this.container.lookup('model:author').create({
    id: '2', attributes: { name: 'Bill' },
    relationships: {
      posts: { data: [{ type: 'posts', id: '1' }], links: { related: ''} }
    }
  });
  let commenter = this.container.lookup('model:commenter').create({
    id: '3', attributes: { name: 'Virgil Erp' },
    relationships: {
      comments: { data: [{ type: 'comments', id: '4' }], links: { related: ''} }
    }
  });
  let comment = this.container.lookup('model:comment').create({
    id: '4', attributes: { body: 'Wyatt become a deputy too.' },
    relationships: {
      commenter: { data: { type: 'commenter', id: '3' }, links: { related: ''} },
      post: { data: { type: 'posts', id: '1' }, links: { related: ''} }
    }
  });

  let authorRelations = '{"posts":{"data":[{"type":"posts","id":"1"}],"links":{"related":""}}}';
  assert.equal(JSON.stringify(author.get('relationships')), authorRelations, 'author relations have a post');

  let postRelations = '{"author":{"data":{"type":"authors","id":"2"},"links":{"related":""}},"comments":{"data":[{"type":"comments","id":"4"}],"links":{"related":""}}}';
  assert.equal(JSON.stringify(post.get('relationships')), postRelations, 'author relations have a post');

  let commentRelations = '{"commenter":{"data":{"type":"commenter","id":"3"},"links":{"related":""}},"post":{"data":{"type":"posts","id":"1"},"links":{"related":""}}}';
  assert.equal(JSON.stringify(comment.get('relationships')), commentRelations, 'comment relations have a commenter');

  let commenterRelations = '{"comments":{"data":[{"type":"comments","id":"4"}],"links":{"related":""}}}';
  assert.equal(JSON.stringify(commenter.get('relationships')), commenterRelations, 'commenter relations have a comment');

  post.removeRelationship('author', '2');
  let postAuthorRelation = '{"data":null,"links":{"related":""}}';
  assert.equal(JSON.stringify(post.get('relationships.author')), postAuthorRelation, 'removed author from post, author relation ok');
  let postCommentsRelation = '{"data":[{"type":"comments","id":"4"}],"links":{"related":""}}';
  assert.equal(JSON.stringify(post.get('relationships.comments')), postCommentsRelation, 'removed author from post, comments relation ok');

  post.removeRelationship('comments', '4');
  postAuthorRelation = '{"data":null,"links":{"related":""}}';
  assert.equal(JSON.stringify(post.get('relationships.author')), postAuthorRelation, 'removed comment from post, author relation ok');
  postCommentsRelation = '{"data":[],"links":{"related":""}}';
  assert.equal(JSON.stringify(post.get('relationships.comments')), postCommentsRelation, 'removed comment from post, comments relation ok');

  author.removeRelationship('posts', '1');
  authorRelations = '{"posts":{"data":[],"links":{"related":""}}}';
  assert.equal(JSON.stringify(author.get('relationships')), authorRelations, 'removed a post from author');

  comment.removeRelationship('commenter', '3');
  let commentCommenterRelations = '{"data":null,"links":{"related":""}}';
  assert.equal(JSON.stringify(comment.get('relationships.commenter')), commentCommenterRelations, 'removed a commenter from comment, commenter relation ok');
  let commentPostRelations = '{"data":{"type":"posts","id":"1"},"links":{"related":""}}';
  assert.equal(JSON.stringify(comment.get('relationships.post')), commentPostRelations, 'removed a commenter from comment, post relation ok');

  comment.removeRelationship('post', '1');
  commentCommenterRelations = '{"data":null,"links":{"related":""}}';
  assert.equal(JSON.stringify(comment.get('relationships.commenter')), commentCommenterRelations, 'removed a post from comment, commenter relation ok');
  commentPostRelations = '{"data":null,"links":{"related":""}}';
  assert.equal(JSON.stringify(comment.get('relationships.post')), commentPostRelations, 'removed a post from comment, post relation ok');

  commenter.removeRelationship('comments', '4');
  commenterRelations = '{"comments":{"data":[],"links":{"related":""}}}';
  assert.equal(JSON.stringify(commenter.get('relationships')), commenterRelations, 'removed a comment from commenter');
});

test('#addRelationships', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'}
  });
  post.addRelationships('comments', ['4', '5']);
  let comments = post.get('relationships.comments.data');
  assert.ok(comments.mapBy('id').indexOf('4') !== -1, 'Comment id 4 added');
  assert.ok(comments.mapBy('id').indexOf('5') !== -1, 'Comment id 5 added');
  assert.equal(comments[0].type, 'comments', 'relation has comments type');
  assert.equal(comments[1].type, 'comments', 'relation has comments type');
  post.addRelationships('author', '2');
  let author = post.get('relationships.author.data');
  assert.equal(author.id, '2', 'Author id 2 added');
  assert.equal(author.type, 'authors', 'Author id 2 added');
});

test('#removeRelationships', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'},
    relationships: {
      author: { data: { type: 'authors', id: '2' }, links: { related: 'url-here'} },
      comments: { data: [{ type: 'comments', id: '4' }], links: { related: 'url-here'} }
    }
  });
  post.removeRelationships('comments', ['4']);
  let comments = post.get('relationships.comments.data');
  assert.equal(comments.length, 0, 'remove comment relation');
  post.removeRelationships('author', '2');
  let author = post.get('relationships.author.data');
  assert.equal(author, null, 'removed author');
});

test('#updateRelationship, from resource-operations mixin', function(assert) {
  let serviceOp = this.sandbox.spy(function() {
    return RSVP.Promise.resolve(null);
  });
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'},
    relationships: {
      author: { data: { type: 'authors', id: '2' }, links: { related: 'url-here'} },
      comments: { data: [{ type: 'comments', id: '4' }], links: { related: 'url-here'} }
    },
    // mock service
    service: { patchRelationship: serviceOp }
  });
  let author = post.get('relationships.author.data');
  let comments = post.get('relationships.comments.data');
  assert.equal(author.id, 2, 'post has author id 2');

  post.updateRelationship('comments', ['4', '5']);
  comments = post.get('relationships.comments.data');
  assert.ok(serviceOp.calledOnce, 'service#patchRelationship called once');
  assert.equal(comments.length, 2, 'post has 2 comments');

  post.updateRelationship('comments', ['1', '2', '3', '4']);
  comments = post.get('relationships.comments.data');
  assert.equal(comments.length, 5, 'post has 5 comments');

  post.updateRelationship('comments', ['1', '2']);
  comments = post.get('relationships.comments.data');
  assert.equal(comments.length, 2, 'post has 2 comments');

  post.updateRelationship('comments', []);
  comments = post.get('relationships.comments.data');
  assert.equal(comments.length, 0, 'post has 0 comments');

  post.updateRelationship('author', '1');
  author = post.get('relationships.author.data');
  assert.equal(author.id, 1, 'author id changed to 1');

  post.updateRelationship('author', null);
  author = post.get('relationships.author.data');
  assert.equal(author, null, 'author removed');
});

test('#didResolveProxyRelation', function(assert) {
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'},
    relationships: {
      author: { data: { type: 'authors', id: '2'}, links: { related: 'url-here'} }
    }
  });
  let author = this.container.lookup('model:author').create({
    id: '2', attributes: { name: 'Bill' },
    relationships: {
      posts: { data: [{ type: 'posts', id: '1' }], links: { related: 'url-here'} }
    }
  });

  post.didResolveProxyRelation('author', 'hasOne', author);

  assert.ok(post.get('relationships.author.data'), 'author data is setup');
  assert.equal(post.get('relationships.author.data.type'), 'authors', 'relation data set for authors type');
  assert.equal(post.get('relationships.author.data.id'), '2', 'relation data set with author id: 2');

  author.didResolveProxyRelation('posts', 'hasMany', post);

  assert.ok(author.get('relationships.posts.data'), 'post data is setup');
  assert.equal(author.get('relationships.posts.data')[0].type, 'posts', 'relation data set for posts type');
  assert.equal(author.get('relationships.posts.data')[0].id, '1', 'relation data set with post id: 1');
});

test('#isNew resource uses relations without proxied content', function(assert) {
  let serviceOp = this.sandbox.spy();
  let post = this.container.lookup('model:post').create({
    id: '1', attributes: {title: 'Wyatt Earp', excerpt: 'Was a gambler.'},
    isNew: true,
    // mock service
    service: { findRelated: serviceOp }
  });
  post.addRelationships('comments', ['4', '5']);
  let comments = post.get('comments');
  assert.equal(serviceOp.calledOnce, false, 'service#findRelated not called after adding to-many');
  assert.equal(comments.get('length'), 0, '0 comments');
  comments = post.get('relationships.comments.data');
  assert.equal(comments.length, 2, '2 items in comments data');

  post.addRelationships('author', '2');
  assert.equal(serviceOp.calledOnce, false, 'service#findRelated not called after adding to-one');
  let author = post.get('author');
  assert.equal(author.id, undefined, 'author id is undefined');
  author = post.get('relationships.author.data');
  assert.equal(author.id, 2, 'author data id is 2');
});

test('#cacheDuration default value is 7 minutes', function(assert) {
  let resource = this.subject();
  assert.equal(resource.get('cacheDuration'), 420000, '420000 milliseconds is default cache duration');
});

test('#isCacheExpired is true when local timestamp plus cacheDuration is now or in the past', function(assert) {
  let resource = this.subject({
    id: '1',
    meta: { timeStamps: { local: Date.now() - 420000 } },
    cacheDuration: 420000
  });
  assert.ok(resource.get('isCacheExpired'), 'cache duration is past');
});

test('#isCacheExpired is false when local timestamp plus cacheDuration is less than now', function(assert) {
  let resource = this.subject({
    id: '1',
    meta: { timeStamps: { local: Date.now() - 419000 } },
    cacheDuration: 420000
  });
  assert.equal(resource.get('isCacheExpired'), false, 'cache duration is in the future');
});
