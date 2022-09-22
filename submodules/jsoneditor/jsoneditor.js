define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	return {
		subscribe: {
			'callflows.fetchActions': 'jsonEditorDefineAction'
		},

		appFlags: {
			unsupportedCallflowsList: {},
			callflowsListSchema: {},
			callflowsListSubSchema: {}
		},

		jsonEditorDefineAction: function(args) {
			var self = this,
				nodes = args.actions;

			$.extend(nodes, {
				'json_editor[]': _.merge({
					name: self.i18n.active().callflows.jsonEditor.title,
					icon: 'pencil',	//graph2
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'jsonEditor',
					tip: self.i18n.active().callflows.jsonEditor.tip,
					data: {},
					rules: [],
					isUsable: 'true',
					weight: 170,
					caption: function(node) {
						return node.module !== 'jsonEditor' ? node.module : '';
					},
					edit: function(node, callback) {
						if (_.isEmpty(self.appFlags.unsupportedCallflowsList)) {
							self.jsonEditorGetSchemasList(function(data) {
								var supportedModules = _
										.chain(monster.apps.callflows.actions)
										.map('module')
										.uniq()
										.filter(_.isString)
										.value(),
									getCallflowModules = _
										.chain(data)
										.filter(function(module) {
											return module.startsWith('callflows.');
										})
										.map(function(module) {
											return module.replace('callflows.', '');
										})
										.value();
								var unsupportedModules = _.difference(getCallflowModules, supportedModules);

								self.appFlags.unsupportedCallflowsList = unsupportedModules;
								self.jsonEditorRender(node, callback);
							});
						} else {
							self.jsonEditorRender(node, callback);
						}
					}
				})
			});
		},

		/**
		 * render the json editor as a pop up element
		 * @param  {object} node - view to render the element
		 * @param  {function} callback - callback to run on successful schema fetch
		 */
		jsonEditorRender: function(node, callback) {
			var self = this,
				popup,
				initTemplate = function() {
					var $template = $(self.getTemplate({
							name: 'json_editor',
							data: {
								name: node.caption ? node.caption : '',
								unsupportedCallflowsList: self.appFlags.unsupportedCallflowsList
							},
							submodule: 'jsoneditor'
						})),
						$target = $template.find('#jsoneditor'),
						options = {
							mode: 'code',
							modes: ['code', 'text'],
							onValidate: function(json) {
								var errors = [];

								if (_.isEmpty(json)) {
									errors.push({
										path: ['empty'],
										message: 'Required json properties are missing.'
									});
								}

								return errors;
							},
							onValidationError: function(errors) {
								if (_.isEmpty(errors)) {
									self.jsonEditorToggleSaveButton($template, true);
								} else {
									self.jsonEditorToggleSaveButton($template, false);
								}
							}
						},
						jsoneditor = monster.ui.jsoneditor($target, options, node.data.data);
					jsoneditor.set(node.data.data, {});
					self.jsonEditorInitSchema($template, jsoneditor, callback);

					$template.find('#save').on('click', function(e) {
						e.preventDefault();

						if ($(this).hasClass('disabled')) {
							return;
						}

						var selectedSchema = $template.find('#name').val();
						var content = jsoneditor.get();

						node.caption = selectedSchema;
						node.module = selectedSchema;

						_.each(content, function(value, key) {
							node.setMetadata(key, value);
						});

						popup.dialog('close');
					});

					$template.find('#name').on('change', function(e) {
						e.preventDefault();

						self.jsonEditorInitSchema($template, jsoneditor, callback);
					});

					return $template;
				};

			popup = monster.ui.dialog(initTemplate(), {
				title: self.i18n.active().callflows.jsonEditor.popupTitle,
				width: 500,
				beforeClose: function() {
					if (_.isFunction(callback)) {
						callback();
					}
				}
			});
		},

		jsonEditorInitSchema: function(template, jsoneditor, callback) {
			var self = this,
				$template = template,
				selectedSchema = $template.find('#name').val(),
				callflowSchema = self.appFlags.callflowsListSchema[selectedSchema],
				callflowSubSchema = self.appFlags.callflowsListSubSchema[selectedSchema];

			if (callflowSchema) {
				jsoneditor.setSchema(callflowSchema, callflowSubSchema);
			} else {
				self.jsonEditorToggleSaveButton($template, false);

				$template
					.find('#name')
						.prop('disabled', true);

				self.jsonEditorGetSchema({
					data: {
						schemaId: 'callflows.' + selectedSchema
					},
					success: function(data) {
						var refList = self.jsonEditorValidateSubSchema(data);

						self.jsonEditorSetSchema(refList, data, jsoneditor, selectedSchema);

						self.jsonEditorSaveSchemaLocally(data, selectedSchema);

						self.jsonEditorToggleSaveButton($template, true);

						$template
							.find('#name')
								.prop('disabled', false);

						callback(null, data);
					}
				});
			}
		},

		/**
		 * Verify if json schema has references
		 * @param  {object} schema
		 */
		jsonEditorValidateSubSchema: function(schema) {
			if (_.has(schema, 'properties.config.$ref')) {
				return [schema.properties.config['$ref]']];
			} else if (_.has(schema, 'properties.macros.items.oneOf')) {
				return _.map(schema.properties.macros.items.oneOf, '$ref');
			} else {
				return false;
			}
		},

		/**
		 * get the list of available schemas
		 * @param  {function} next - callback to run on success
		 */
		jsonEditorGetSchemasList: function(next) {
			var self = this;

			self.callApi({
				resource: 'schemas.list',
				success: _.flow(
					_.partial(_.get, _, 'data'),
					next
				)
			});
		},
		/**
		 * @param  {object} args
		 * @param args.data - object with id property to define the schema th fetch
		 * @param args.success - function to use as the CallApi success property
		 */
		jsonEditorGetSchema: function(args) {
			var self = this,
				data = args.data;

			self.callApi({
				resource: 'schemas.get',
				data: {
					schemaId: data.schemaId
				},
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * toggle editor save button enabled/disabled
		 * @param  {object} template - JSON editor template
		 * @param  {boolean} enable - true to enable save button, false to disable
		 */
		jsonEditorToggleSaveButton: function(template, enabled) {
			if (enabled) {
				template.find('#save').removeClass('disabled');
			} else {
				template.find('#save').addClass('disabled');
			}
		},

		/**
		 * save the schema in local storage
		 * @param  {object} data - JSON schema
		 * @param  {object} selectedSchema - selected JSON SCHEMA option
		 * @param  {boolean} isSubSchema - flag if schema is sub schema
		 */
		jsonEditorSaveSchemaLocally: function(data, selectedSchema, isSubSchema) {
			var self = this;
			if (isSubSchema) {
				self.appFlags.callflowsListSubSchema[selectedSchema] = data;
			} else {
				self.appFlags.callflowsListSchema[selectedSchema] = data;
			}
		},

		/**
		 * validate if the JSON schema should be set with sub schemas or not
		 * @param  {string[]} refList - list of references
		 * @param  {object} data - JSON schema
		 * @param  {object} jsoneditor - JSON editor instance
		 * @param  {string} selectedSchema - selected JSON SCHEMA option
		 */
		jsonEditorSetSchema: function(refList, data, jsoneditor, selectedSchema) {
			var self = this;
			if (refList) {
				self.jsonEditorGetSubSchema(refList, data, jsoneditor, selectedSchema);
			} else {
				jsoneditor.setSchema(data);
			}
		},

		/**
		 *  Get the required sub schemas from the main JSON schema
		 * @param  {string[]} refList - list of subschemas to fetch
		 * @param  {object} parentSchema - schema to which subschemas are added
		 * @param  {object} jsoneditor - jsoneditor instance
		 * @param  {string} selectedSchema - selected JSON SCHEMA option
		 */
		jsonEditorGetSubSchema: function(refList, parentSchema, jsoneditor, selectedSchema) {
			var self = this;

			monster.parallel(
				_.chain(refList)
				.keyBy()
				.mapValues(function(ref) {
					//api call to get subschema
					return function(callback) {
						self.jsonEditorGetSchema({
							data: {
								schemaId: ref
							},
							success: function(data) {
								callback(null, data);
							}
						});
					};
				})
				.value()
				, function(err, results) {
					self.jsonEditorSaveSchemaLocally(results, selectedSchema, true);
					jsoneditor.setSchema(parentSchema, results);
				});
		}
	};
});
