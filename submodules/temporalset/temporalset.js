define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'temporalsetDefineActions',
			'callflows.temporalset.edit': '_temporalsetEdit'
		},

		temporalsetSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.temporalsetNormalizeData($.extend(true, {}, data.data, form_data), form_data);

			if (typeof data.data === 'object' && data.data.id) {
				self.temporalSetUpdate(normalized_data, function(_data, status) {
					success && success(_data, status, 'update');
				});
			} else {
				self.temporalSetCreate(normalized_data, function(_data, status) {
					success & success(_data, status, 'create');
				});
			}
		},

		temporalsetPopupEdit: function(args) {
			var self = this,
				popup,
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html = $('<div class="inline_popup callflows-port"><div class="main_content inline_content"/></div>');

			self.temporalsetEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = monster.ui.dialog(popup_html, {
						title: (data.id) ? self.i18n.active().callflows.temporalset.editSet : self.i18n.active().callflows.temporalset.createSet
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring temporalsetEdit
		_temporalsetEdit: function(args) {
			var self = this;
			self.temporalsetEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		temporalsetEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#temporalset-content'),
				target = _target || $('#temporalset-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						extra: {
							showSave: true
						}
					}, data_defaults || {}),
					field_data: {}
				};

			self.temporalSetGetData((data || {}).id, function(results) {
				var formattedData = self.temporalsetFormatData(results.temporalSet),
					templateData = $.extend(true, defaults, { data: formattedData, field_data: { rules: results.temporalRules } });

				self.temporalsetRender(templateData, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}
			});/*

			if (typeof data === 'object' && data.id) {
				self.temporalSetGet(data.id, function(_data, status) {
					var oldFormatData = { data: _data };

					self.temporalsetFormatData(oldFormatData);

					self.temporalsetRender($.extend(true, defaults, oldFormatData), target, callbacks);

					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}
				});
			} else {
				self.temporalsetRender(defaults, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}
			}*/
		},

		temporalSetGetData: function(id, callback) {
			var self = this;

			monster.parallel({
				'temporalSet': function(callback) {
					if (id) {
						self.temporalSetGet(id, function(data) {
							callback && callback(null, data);
						});
					} else {
						callback && callback(null, {});
					}
				},
				'temporalRules': function(callback) {
					self.temporalSetGetAllRules(function(data) {
						callback && callback(null, data);
					});
				}
			},
			function(err, results) {
				callback && callback(results);
			});
		},

		temporalSetFormatRules: function(data) {
			var self = this,
				mapRules = _.keyBy(data.field_data.rules, 'id'),
				formattedData = {};

			formattedData.available = _.map(data.field_data.rules, function(rule) {
				return { key: rule.id, value: rule.name };
			});

			formattedData.selected = _.chain(data.data.temporal_rules)
				.filter(function(id) {
					if (mapRules.hasOwnProperty(id)) {
						return id;
					}
				}).map(function(id) {
					return {
						key: id,
						value: mapRules[id].name
					};
				}).value();

			return formattedData;
		},

		temporalsetRender: function(data, target, callbacks) {
			var self = this,
				temporalset_html = $(self.getTemplate({
					name: 'callflowEdit',
					data: data,
					submodule: 'temporalset'
				})),
				temporalsetForm = temporalset_html.find('#temporalset-form'),
				widgetRules = self.temporalSetFormatRules(data);

			var widget = monster.ui.linkedColumns(temporalset_html.find('.items-selector-wrapper'), widgetRules.available, widgetRules.selected, {
				i18n: {
					columnsTitles: {
						available: self.i18n.active().callflows.temporalset.unselectedTOD,
						selected: self.i18n.active().callflows.temporalset.selectedTOD
					}
				},
				containerClasses: 'skinny'
			});

			monster.ui.validate(temporalsetForm);

			$('*[rel=popover]', temporalset_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(temporalset_html);

			$('.temporalset-save', temporalset_html).click(function(ev) {
				ev.preventDefault();

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(temporalsetForm)) {
						var form_data = monster.ui.getFormData('temporalset-form');
						form_data.temporal_rules = widget.getSelectedItems();

						form_data = self.temporalsetCleanFormData(form_data);

						self.temporalsetSave(form_data, data, callbacks.save_success);
					} else {
						$this.removeClass('disabled');
						monster.ui.alert('error', self.i18n.active().callflows.temporalset.there_were_errors_on_the_form);
					}
				}
			});

			$('.temporalset-delete', temporalset_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.temporalset.are_you_sure_you_want_to_delete, function() {
					self.temporalSetDelete(data.data.id, callbacks.delete_success);
				});
			});

			(target)
				.empty()
				.append(temporalset_html);
		},

		temporalsetCleanFormData: function(form_data) {
			return form_data;
		},

		temporalsetNormalizeData: function(merged_data, form_data) {
			// Because extend doesn't merge arrays properly
			delete merged_data.temporal_rules;
			merged_data.temporal_rules = form_data.temporal_rules;

			delete merged_data.extra;

			return merged_data;
		},

		temporalsetFormatData: function(data) {
			data.extra = data.extra || {};
			data.extra.showSave = true;
			data.extra.showDelete = data.id ? true : false;

			if (data.hasOwnProperty('ui_metadata') && data.ui_metadata.hasOwnProperty('origin') && data.ui_metadata.origin === 'voip') {
				data.extra.showSave = false;

				if (!monster.util.isSuperDuper()) {
					data.extra.showDelete = false;
				}
			}

			return data;
		},

		temporalsetDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'temporal_set[]': {
					name: self.i18n.active().callflows.temporalset.name,
					module: 'temporal_set',
					listEntities: function(callback) {
						self.temporalSetList(function(data) {
							callback && callback(data);
						});
					},
					editEntity: 'callflows.temporalset.edit'
				}
			});
		},

		temporalSetGetAllRules: function(callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalSetList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalSetGet: function(temporalSetId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.get',
				data: {
					accountId: self.accountId,
					setId: temporalSetId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalSetCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalSetUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.update',
				data: {
					accountId: self.accountId,
					setId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalSetDelete: function(temporalSetId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.delete',
				data: {
					accountId: self.accountId,
					setId: temporalSetId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
