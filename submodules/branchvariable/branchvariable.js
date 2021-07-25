define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash');

	return {
		subscribe: {
			'callflows.fetchActions': 'branchvariableDefineAction'
		},

		branchvariableDefineAction: function(args) {
			var self = this,
				nodes = args.actions;

			$.extend(nodes, {
				'branch_variable[id=*]': _.merge({
					icon: 'arrow_sign',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'branch_variable',
					isUsable: 'true',
					caption: function(node) {
						return node.getMetadata('variable', '');
					},
					edit: console.log
				}, _.pick(self.i18n.active().callflows.branchvariable, [
					'name',
					'tip'
				]))
			});
		}
	};
});
