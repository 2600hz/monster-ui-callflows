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
				'branch_variable[]': _.merge({
					icon: 'arrow_sign',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'branch_variable',
					isUsable: 'true',
					caption: function(node) {
						return node.getMetadata('variable', '');
					},
					edit: _.bind(self.branchvariableCallflowEdit, self),
					key_caption: function(node) {
						var key = node.key;

						return _.get({
							_: self.i18n.active().callflows.menu.default_action
						}, key, key);
					},
					key_edit: _.bind(self.branchvariableCallflowKeyEdit, self)
				}, _.pick(self.i18n.active().callflows.branchvariable, [
					'name',
					'tip'
				]))
			});
		},

		branchvariableCallflowEdit: function(node, callback) {
			var self = this,
				initTemplate = function(scopeSchema) {
					var id = node.getMetadata('id');

					return $(self.getTemplate({
						name: 'callflowEdit',
						data: _.merge({
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
						}, id && {
							id: id
						}),
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

						if (formData.scope === 'doc') {
							node.setMetadata('id', id);
						} else {
							node.deleteMetadata('id');
						}

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
		},

		branchvariableCallflowKeyEdit: function(node, callback) {
			var self = this,
				initTemplate = function(key) {
					return $(self.getTemplate({
						name: 'callflowKey',
						data: key === '_' ? {
							action: 'default',
							value: ''
						} : {
							action: 'variable',
							value: key
						},
						submodule: 'branchvariable'
					}));
				},
				bindEvents = function($popup) {
					var $form = $popup.find('form');

					monster.ui.validate($form, {
						rules: {
							value: {
								required: true
							}
						}
					});

					$form.find('select[name="action"]').on('change', function(event) {
						event.preventDefault();

						var $select = $(this),
							newValue = $select.val();

						$select.parents('.control-group').siblings('.control-group').toggle(newValue === 'variable');
					});

					$popup.find('#save').on('click', function(event) {
						event.preventDefault();

						if (!monster.ui.valid($form)) {
							return;
						}
						var formData = monster.ui.getFormData($form.get(0));

						node.key = formData.action === 'default' ? '_' : formData.value;
						node.key_caption = formData.action === 'default' ? self.i18n.active().callflows.menu.default_action : formData.value;

						$popup.dialog('close');
					});
				},
				renderTemplate = _.flow(
					initTemplate,
					_.bind(monster.ui.dialog, monster.ui, _, {
						title: self.i18n.active().callflows.branchvariable.name,
						beforeClose: callback
					}),
					bindEvents
				);

			renderTemplate(node.key);
		}
	};
});
