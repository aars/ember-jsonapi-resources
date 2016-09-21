import Ember from 'ember';

export default Ember.Mixin.create({
  _hasDefaults() {
    return (typeof this.getDefaults === 'function');
  },

  create(properties) {
    let defaults = (this._hasDefaults()) ? this.getDefaults() : {};
    Object.keys(defaults).forEach(attr => {
      properties[attr] = Ember.merge(properties[attr] || {}, defaults[attr]);
    });
    return this._super(properties);
  }
});