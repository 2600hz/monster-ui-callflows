define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

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
					edit: _.bind(self.branchvariableCallflowEdit, self)
				}, _.pick(self.i18n.active().callflows.branchvariable, [
					'name',
					'tip'
				]))
			});
		},

		branchvariableCallflowEdit: function(node, callback) {
			var self = this,
				initTemplate = function(scopeSchema) {
					return $(self.getTemplate({
						name: 'callflowEdit',
						data: {
							id: node.getMetadata('id', undefined),
							scope: {
								selected: node.getMetadata('scope', scopeSchema.default),
								options: _.sortBy(scopeSchema.enum)
							},
							variable: _
								.chain([
									node.getMetadata('variable', '')
								])
								.flatten()
								.join('.')
								.value()
						},
						submodule: 'branchvariable'
					}));
				},
				bindEvents = function($popup) {
					var $form = $popup.find('form');

					monster.ui.validate($form, {
						rules: {
							id: {
								required: true
							},
							variable: {
								required: true
							}
						}
					});

					$popup.find('#scope').on('change', function(event) {
						event.preventDefault();

						var selected = $(this).val(),
							shouldShowId = selected === 'doc',
							$id = $popup.find('#id');

						if (!shouldShowId) {
							$id.val('');
						}
						$id.parents('.control-group').toggle(shouldShowId);
					});

					$popup.find('#save').on('click', function(event) {
						event.preventDefault();

						if (!monster.ui.valid($form)) {
							return;
						}
						var formData = monster.ui.getFormData($form.get(0)),
							id = formData.id;

						node.setMetadata('scope', formData.scope);
						node.setMetadata('variable', _.split(formData.variable, '.'));
						node.setMetadata('id', id);

						$popup.dialog('close');
					});
				},
				renderTemplate = _.flow(
					_.partial(_.get, _, 'properties.scope'),
					initTemplate,
					_.bind(monster.ui.dialog, monster.ui, _, {
						title: self.i18n.active().callflows.branchvariable.name,
						beforeClose: callback
					}),
					bindEvents
				);

			self.branchvariableCallflowGetData(renderTemplate);
		},

		branchvariableCallflowGetData: function(next) {
			var self = this;

			self.callApi({
				resource: 'schemas.get',
				data: {
					schemaId: 'callflows.branch_variable'
				},
				success: _.flow(
					_.partial(_.get, _, 'data'),
					next
				)
			});
		}
	};
});
