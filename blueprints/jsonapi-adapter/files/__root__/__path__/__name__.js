<%= importStatement %>

export default <%= baseClass %>.extend({
  type: '<%= entity %>',

  url: [config.APP.API_HOST, config.APP.API_PATH, '<%= resource %>'].join('/')
});
