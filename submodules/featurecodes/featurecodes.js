define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.featurecode.render': 'featureCodeRender'
		},

		featureCodeRender: function(pContainer) {
			var self = this,
				container = pContainer || $('.callflow-edition');

			self.featureCodeGetData(function(featureCodes) {
				var formattedData = self.featureCodeFormatData(featureCodes),
					template = $(self.getTemplate({
						name: 'view',
						data: formattedData,
						submodule: 'featurecodes'
					}));

				self.featureCodeBindEvents(template, formattedData.actions);

				container
					.empty()
					.append(template);
			});
		},

		featureCodeGetData: function(callback) {
			var self = this;

			self.featureCodeList(function(data) {
				callback && callback(data);
			});
		},

		featureCodeFormatData: function(data) {
			var self = this,
				actions = self.featureCodesDefine();

			return {
				actions: _.transform(data, function(object, callflow) {
					_.merge(object[callflow.featurecode.name], {
						id: callflow.id,
						enabled: true,
						number: callflow.featurecode.number.replace('\\', '')
					});
				}, actions),
				categories: _
					.chain(actions)
					.map(function(value, key) {
						return _.merge(value, {
							action: key
						});
					})
					.groupBy('category')
					.map(function(codes, category) {
						return {
							category: category,
							items: _
								.chain(codes)
								.map(function(code) {
									return _.merge({
										hasConfig: _.isFunction(code.editConfiguration),
										number: _.get(code, 'number', code.default_number),
										tag: code.action
									}, _.pick(code, [
										'enabled',
										'hasStar',
										'id',
										'name',
										'number_type'
									]));
								})
								.sortBy(function(code) {
									var number = _.toNumber(code.number);

									return _.isNaN(number) ? -1 : number;
								})
								.value()
						};
					})
					.sortBy('category')
					.value()
			};
		},

		featureCodeBindEvents: function(template, actions) {
			var self = this;

			monster.ui.tooltips(template);

			template.find('.featurecode_enabled').each(function() {
				var action_wrapper = $(this).parents('.action_wrapper'),
					number_field = action_wrapper.find('.featurecode-number');

				!$(this).is(':checked') ? $(number_field).attr('disabled', '') : $(number_field).removeAttr('disabled');
			});

			template.find('.featurecode-number').on('blur keyup focus', function() {
				var action_wrapper = $(this).parents('.action_wrapper');

				action_wrapper.data('number', $(this).val());

				$(this).val() !== actions[action_wrapper.data('action')].number ? action_wrapper.addClass('changed') : action_wrapper.removeClass('changed');
			});

			template.find('.featurecode_enabled').on('change', function() {
			//$('.featurecode_enabled', template).change(function() {
				var $this = $(this),
					action_wrapper = $this.parents('.action_wrapper'),
					number_field = action_wrapper.find('.featurecode-number');

				if (!$this.is(':checked') && action_wrapper.data('enabled') === true) {
					action_wrapper.addClass('disabled');
				} else if ($this.is(':checked') && action_wrapper.data('enabled') === false) {
					action_wrapper.addClass('enabled');
				} else {
					action_wrapper.removeClass('enabled');
					action_wrapper.removeClass('disabled');
				}

				!$this.is(':checked') ? number_field.attr('disabled', '') : number_field.removeAttr('disabled');
			});

			template.find('.featurecode-save').on('click', function(e) {
				var $this = $(this);
				e.preventDefault();
				if (!$this.hasClass('disabled')) {
					var formData = self.featureCodeCleanFormData(template, actions);

					$this.addClass('disabled');

					self.featureCodeMassUpdate(formData, function() {
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().callflows.featureCodes.successUpdate
						});
						$this.removeClass('disabled');

						self.featureCodeRender();
					},
					function() {
						$this.removeClass('disabled');
					});
				}
			});

			_.each(actions, function(item) {
				if (item.hasOwnProperty('editConfiguration')) {
					template.find('[data-id="' + item.id + '"] .edit-configuration-link').on('click', function() {
						item.editConfiguration();
					});
				}
			});
		},

		featureCodeList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						has_key: 'featurecode.name',
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		featureCodeGet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: id
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		featureCodeCleanFormData: function(template, actions) {
			var self = this,
				form_data = {
					created_callflows: [],
					deleted_callflows: [],
					updated_callflows: []
				};

			template.find('.enabled').each(function() {
				var callflow = $(this).data();

				// Casting in String, as back-end requires a String
				callflow.number += '';

				callflow.flow = {
					data: actions[callflow.action].data,
					module: actions[callflow.action].module,
					children: {}
				};

				// if (callflow.type === 'number') { callflow.type = 'numbers'}
				// if (callflow.type === 'pattern') { callflow.type = 'patterns'}

				/* if a star is in the pattern, then we need to escape it */
				if (callflow.type === 'patterns' && typeof callflow.number === 'string') {
					callflow.number = callflow.number.replace(/([*])/g, '\\$1');
				}

				callflow[callflow.type] = [actions[callflow.action].build_regex(callflow.number)];
				form_data.created_callflows.push(callflow);
			});

			template.find('.disabled').each(function() {
				var callflow = $(this).data();

				callflow.number += '';

				form_data.deleted_callflows.push(callflow);
			});

			template.find('.changed:not(.enabled, .disabled)').each(function() {
				if ($(this).data('enabled')) {
					var callflow = $(this).data();

					// Casting in String, as back-end requires a String
					callflow.number += '';

					callflow.flow = {
						data: actions[callflow.action].data,
						module: actions[callflow.action].module,
						children: {}
					};

					/* if a star is in the pattern, then we need to escape it */
					if (callflow.type === 'patterns') {
						callflow.number = callflow.number.replace(/([*])/g, '\\$1');
					}

					callflow[callflow.type] = [actions[callflow.action].build_regex(callflow.number)];

					form_data.updated_callflows.push(callflow);
				}
			});

			return form_data;
		},

		featureCodeCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		featureCodeDelete: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.delete',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		featureCodeUpdate: function(callflowId, data, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflowId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		featureCodeMassUpdate: function(form_data, callback, errorCallback) {
			var self = this,
				count = form_data.created_callflows.length + form_data.deleted_callflows.length + form_data.updated_callflows.length;

			if (count) {
				var parallelRequests = {};

				_.each(form_data.created_callflows, function(callflow) {
					parallelRequests['create_' + callflow.action] = function(callback) {
						var dataCallflow = {
							flow: callflow.flow,
							patterns: callflow.patterns,
							numbers: callflow.numbers,
							featurecode: {
								name: callflow.action,
								number: callflow.number
							}
						};

						self.featureCodeCreate(dataCallflow, function(data) {
							callback && callback(null, data);
						});
					};
				});

				_.each(form_data.updated_callflows, function(callflow) {
					parallelRequests['update_' + callflow.action] = function(callback) {
						var dataCallflow = {
							flow: callflow.flow,
							patterns: callflow.patterns,
							numbers: callflow.numbers,
							featurecode: {
								name: callflow.action,
								number: callflow.number
							}
						};

						self.featureCodeUpdate(callflow.id, dataCallflow, function(data) {
							callback && callback(null, data);
						});
					};
				});

				_.each(form_data.deleted_callflows, function(callflow) {
					parallelRequests['delete_' + callflow.action] = function(callback) {
						self.featureCodeDelete(callflow.id, function(data) {
							callback && callback(null, data);
						});
					};
				});

				monster.parallel(parallelRequests, function(err, results) {
					callback && callback();
				});
			} else {
				errorCallback && errorCallback();
				monster.ui.toast({
					type: 'error',
					message: self.i18n.active().callflows.featureCodes.nothing_to_save
				});
			}
		},

		featureCodesDefine: function(featurecodes) {
			var self = this;

			return {
				directed_ext_pickup: {
					name: self.i18n.active().callflows.featureCodes.directed_ext_pickup,
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'group_pickup_feature',
					number_type: 'patterns',
					data: {
						type: 'extension'
					},
					enabled: false,
					hasStar: true,
					default_number: '87',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]+)$';
					}
				},
				'call_forward[action=activate]': {
					name: self.i18n.active().callflows.featureCodes.enable_call_forward,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.call_forward_cat,
					module: 'call_forward',
					number_type: 'numbers',
					data: {
						action: 'activate'
					},
					enabled: false,
					hasStar: true,
					default_number: '72',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'call_forward[action=deactivate]': {
					name: self.i18n.active().callflows.featureCodes.disable_call_forward,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.call_forward_cat,
					module: 'call_forward',
					number_type: 'numbers',
					data: {
						action: 'deactivate'
					},
					enabled: false,
					hasStar: true,
					default_number: '73',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'call_forward[action=toggle]': {
					name: self.i18n.active().callflows.featureCodes.toggle_call_forward,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.call_forward_cat,
					module: 'call_forward',
					number_type: 'patterns',
					data: {
						action: 'toggle'
					},
					enabled: false,
					hasStar: true,
					default_number: '74',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'call_forward[action=update]': {
					name: self.i18n.active().callflows.featureCodes.update_call_forward,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.call_forward_cat,
					module: 'call_forward',
					number_type: 'numbers',
					data: {
						action: 'update'
					},
					enabled: false,
					hasStar: true,
					default_number: '56',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},

				'hotdesk[action=login]': {
					name: self.i18n.active().callflows.featureCodes.enable_hot_desking,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.hot_desking_cat,
					module: 'hotdesk',
					number_type: 'numbers',
					data: {
						action: 'login'
					},
					enabled: false,
					hasStar: true,
					default_number: '11',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'hotdesk[action=logout]': {
					name: self.i18n.active().callflows.featureCodes.disable_hot_desking,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.hot_desking_cat,
					module: 'hotdesk',
					number_type: 'numbers',
					data: {
						action: 'logout'
					},
					enabled: false,
					hasStar: true,
					default_number: '12',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'hotdesk[action=toggle]': {
					name: self.i18n.active().callflows.featureCodes.toggle_hot_desking,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.hot_desking_cat,
					module: 'hotdesk',
					number_type: 'numbers',
					data: {
						action: 'toggle'
					},
					enabled: false,
					hasStar: true,
					default_number: '13',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'voicemail[action=check]': {
					name: self.i18n.active().callflows.featureCodes.check_voicemail,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'voicemail',
					number_type: 'patterns',
					data: {
						action: 'check'
					},
					enabled: false,
					hasStar: true,
					default_number: '97',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'voicemail[single_mailbox_login]': {
					name: self.i18n.active().callflows.featureCodes.single_mailbox_login,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'voicemail',
					number_type: 'patterns',
					data: {
						action: 'check',
						single_mailbox_login: true
					},
					enabled: false,
					hasStar: true,
					default_number: '98',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'voicemail[action="direct"]': {
					name: self.i18n.active().callflows.featureCodes.direct_to_voicemail,
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'voicemail',
					number_type: 'patterns',
					data: {
						action: 'compose'
					},
					enabled: false,
					hasStar: true,
					default_number: '*',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'intercom': {
					name: self.i18n.active().callflows.featureCodes.intercom,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'intercom',
					number_type: 'patterns',
					data: {
					},
					enabled: false,
					hasStar: true,
					default_number: '0',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'privacy[mode=full]': {
					name: self.i18n.active().callflows.featureCodes.privacy,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'privacy',
					number_type: 'patterns',
					data: {
						mode: 'full'
					},
					enabled: false,
					hasStar: true,
					default_number: '67',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'park_and_retrieve': {
					name: self.i18n.active().callflows.featureCodes.park_and_retrieve,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.parking_cat,
					module: 'park',
					number_type: 'patterns',
					data: {
						action: 'auto'
					},
					enabled: false,
					hasStar: true,
					editConfiguration: function() {
						self.featureCodesEditParkingParkAndRetrieve(this);
					},
					default_number: '3',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'valet': {
					name: self.i18n.active().callflows.featureCodes.valet,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.parking_cat,
					module: 'park',
					number_type: 'numbers',
					data: {
						action: 'park'
					},
					enabled: false,
					hasStar: true,
					editConfiguration: function() {
						self.featureCodesEditParkingValet(this);
					},
					default_number: '4',
					number: this.default_number,
					build_regex: function(number) {
						return '*' + number;
					}
				},
				'retrieve': {
					name: self.i18n.active().callflows.featureCodes.retrieve,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.parking_cat,
					module: 'park',
					number_type: 'patterns',
					data: {
						action: 'retrieve'
					},
					enabled: false,
					hasStar: true,
					default_number: '5',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*' + number + '([0-9]*)$';
					}
				},
				'move': {
					name: self.i18n.active().callflows.featureCodes.callMove,
					icon: 'phone',
					category: self.i18n.active().callflows.featureCodes.miscellaneous_cat,
					module: 'move',
					number_type: 'numbers',
					data: {
					},
					enabled: false,
					hasStar: false,
					default_number: '6683',
					number: this.default_number,
					build_regex: function(number) {
						return number;
					}
				}
				/*'call_forward[action=on_busy_enable]': {
					name: 'Enable Call-Forward on Busy',
					icon: 'phone',
					category: 'Call-Forward',
					module: 'call_forward',
					number_type: 'patterns',
					data: {
						action: 'on_busy_enable'
					},
					enabled: false,
					hasStar: true,
					default_number: '90',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'call_forward[action=on_busy_disable]': {
					name: 'Disable Call-Forward on Busy',
					icon: 'phone',
					category: 'Call-Forward',
					module: 'call_forward',
					number_type: 'numbers',
					data: {
						action: 'on_busy_disable'
					},
					enabled: false,
					hasStar: true,
					default_number: '91',
					number: this.default_number,
					build_regex: function(number) {
						return '*'+number;
					}
				},
				'call_forward[action=no_answer_enable]': {
					name: 'Enable Call-Forward No Answer',
					icon: 'phone',
					category: 'Call-Forward',
					module: 'call_forward',
					number_type: 'patterns',
					data: {
						action: 'no_answer_enable'
					},
					enabled: false,
					hasStar: true,
					default_number: '53',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'call_forward[action=no_answer_disable]': {
					name: 'Disable Call-Forward No Answer',
					icon: 'phone',
					category: 'Call-Forward',
					module: 'call_forward',
					number_type: 'numbers',
					data: {
						action: 'no_answer_disable'
					},
					enabled: false,
					hasStar: true,
					default_number: '52',
					number: this.default_number,
					build_regex: function(number) {
						return '*'+number;
					}
				},
				'donotdisturb[action="enable"]': {
					name: 'Enable Do not disturb',
					icon: 'phone',
					category: 'Do not disturb',
					module: 'do_not_disturb',
					number_type: 'patterns',
					data: {
						action: 'enable'
					},
					enabled: false,
					hasStar: true,
					default_number: '78',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'donotdisturb[action="disable"]': {
					name: 'Disable Do not disturb',
					icon: 'phone',
					category: 'Do not disturb',
					module: 'do_not_disturb',
					number_type: 'numbers',
					data: {
						action: 'disable'
					},
					enabled: false,
					hasStar: true,
					default_number: '79',
					number: this.default_number,
					build_regex: function(number) {
						return '*'+number;
					}
				},
				'donotdisturb[action="toggle"]': {
					name: 'Toggle Do not disturb',
					icon: 'phone',
					category: 'Do not disturb',
					module: 'do_not_disturb',
					number_type: 'patterns',
					data: {
						action: 'toggle'
					},
					enabled: false,
					hasStar: true,
					default_number: '76',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'directory': {
					name: 'Directory',
					icon: 'phone',
					category: 'Miscellaneous',
					module: 'directory',
					number_type: 'patterns',
					data: {
						action: ''
					},
					enabled: false,
					hasStar: true,
					default_number: '411',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'time': {
					name: 'Check Time',
					icon: 'phone',
					category: 'Miscellaneous',
					module: 'time',
					number_type: 'patterns',
					data: {
						action: ''
					},
					enabled: false,
					hasStar: true,
					default_number: '60',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'call_waiting[action=enable]': {
					name: 'Enable Call-Waiting',
					icon: 'phone',
					category: 'Miscellaneous',
					module: 'call_waiting',
					number_type: 'patterns',
					data: {
						action: 'enable'
					},
					enabled: false,
					hasStar: true,
					default_number: '70',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},
				'call_waiting[action=disable]': {
					name: 'Disable Call-Waiting',
					icon: 'phone',
					category: 'Miscellaneous',
					module: 'call_waiting',
					number_type: 'numbers',
					data: {
						action: 'disable'
					},
					enabled: false,
					hasStar: true,
					default_number: '71',
					number: this.default_number,
					build_regex: function(number) {
						return '*'+number;
					}
				},

				'sound_test_service': {
					name: 'Sound Test Service',
					icon: 'phone',
					category: 'Miscellaneous',
					module: '',
					number_type: 'patterns',
					data: {
						action: ''
					},
					enabled: false,
					hasStar: true,
					default_number: '43',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				},

				'call_recording': {
					name: 'Call Recording',
					icon: 'phone',
					category: 'Miscellaneous',
					module: 'call_recording',
					number_type: 'patterns',
					data: {
						action: ''
					},
					enabled: false,
					hasStar: true,
					default_number: '1',
					number: this.default_number,
					build_regex: function(number) {
						return '^\\*'+number+'([0-9]*)$';
					}
				}*/
			};
		},

		featureCodesEditParkingParkAndRetrieve: function(featureCode) {
			var self = this;

			self.featureCodeGet(featureCode.id, function(data) {
				var popup,
					formattedData = self.featureCodesFormatParkingData(data),
					template = $(self.getTemplate({
						name: 'parking-parkandretrieve',
						submodule: 'featurecodes',
						data: formattedData
					}));

				monster.ui.validate(template.find('#form_park_retrieve'), {
					rules: {
						'default_ringback_timeout': {
							'digits': true
						},
						'default_callback_timeout': {
							'digits': true
						}
					}
				});

				monster.ui.tooltips(template);

				template.find('#save').on('click', function(e) {
					e.preventDefault();

					if (monster.ui.valid(template.find('#form_park_retrieve'))) {
						var formData = monster.ui.getFormData('form_park_retrieve'),
							dataToUpdate = self.featureCodesNormalizeData(data, formData);

						self.featureCodeUpdate(dataToUpdate.id, dataToUpdate, function() {
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().callflows.featureCodes.parkingParkAndRetrievePopup.successUpdate
							});
							popup.dialog('close');
						});
					}
				});

				popup = monster.ui.dialog(template, {
					title: self.i18n.active().callflows.featureCodes.parkingParkAndRetrievePopup.title
				});
			});
		},

		featureCodesEditParkingValet: function(featureCode) {
			var self = this;

			self.featureCodeGet(featureCode.id, function(data) {
				var popup,
					formattedData = self.featureCodesFormatParkingData(data),
					template = $(self.getTemplate({
						name: 'parking-valet',
						submodule: 'featurecodes',
						data: formattedData
					}));

				monster.ui.validate(template.find('#form_valet'), {
					rules: {
						'default_ringback_timeout': {
							'digits': true
						},
						'default_callback_timeout': {
							'digits': true
						}
					}
				});

				monster.ui.tooltips(template);

				template.find('#save').on('click', function(e) {
					e.preventDefault();

					if (monster.ui.valid(template.find('#form_valet'))) {
						var formData = monster.ui.getFormData('form_valet'),
							dataToUpdate = self.featureCodesNormalizeData(data, formData);

						self.featureCodeUpdate(dataToUpdate.id, dataToUpdate, function() {
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().callflows.featureCodes.parkingValetPopup.successUpdate
							});
							popup.dialog('close');
						});
					}
				});

				popup = monster.ui.dialog(template, {
					title: self.i18n.active().callflows.featureCodes.parkingValetPopup.title
				});
			});
		},

		featureCodesNormalizeData: function(data, formData) {
			var self = this,
				dataToUpdate = $.extend(true, {}, data);

			// If user leaves field empty, we want to delete the field, so it goes back to system default.
			// Otherwise we transform seconds into milliseconds for back-end
			if (formData.default_callback_timeout.length) {
				dataToUpdate.flow.data.default_callback_timeout = parseInt(formData.default_callback_timeout) * 1000;
			} else {
				delete dataToUpdate.flow.data.default_callback_timeout;
			}

			if (formData.default_ringback_timeout.length) {
				dataToUpdate.flow.data.default_ringback_timeout = parseInt(formData.default_ringback_timeout) * 1000;
			} else {
				delete dataToUpdate.flow.data.default_ringback_timeout;
			}

			return dataToUpdate;
		},

		featureCodesFormatParkingData: function(data) {
			var formattedData = $.extend(true, {}, data.flow.data);

			if (formattedData.hasOwnProperty('default_callback_timeout')) {
				formattedData.default_callback_timeout /= 1000;
			}

			if (formattedData.hasOwnProperty('default_ringback_timeout')) {
				formattedData.default_ringback_timeout /= 1000;
			}

			return formattedData;
		}
	};

	return app;
});
