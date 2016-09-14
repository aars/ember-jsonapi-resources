import Ember from 'ember';

export default Ember.Mixin.create({
  _hasDefaults() {
    return (typeof this.getDefaults === 'function');
  },

  create(properties) {
    let defaults = (this._hasDefaults()) ? this.getDefaults() : {};
    properties   = Ember.merge(properties || {}, defaults);

    return this._super(properties);
  }
});
