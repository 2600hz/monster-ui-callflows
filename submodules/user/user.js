define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'userDefineActions',
			'callflows.user.popupEdit': 'userPopupEdit',
			'callflows.user.edit': 'userEdit'
		},

		random_id: false,

		userDefineActions: function(args) {
			var self = this,
				callflow_nodes= args.actions;

			$.extend(callflow_nodes, {
				 'user[id=*]': {
					name: self.i18n.active().callflows.user.user,
					icon: 'user',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'user',
					tip: self.i18n.active().callflows.user.user_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 40,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if(id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						self.userList(function(users) {
							var popup, popup_html;

							$.each(users, function() {
								this.name = this.first_name + ' ' + this.last_name;
							});

							popup_html = $(monster.template(self, 'user-callflowEdit' , {
								can_call_self: node.getMetadata('can_call_self') || false,
								parameter: {
									name: 'timeout (s)',
									value: node.getMetadata('timeout') || '20'
								},
								objects: {
									items: monster.util.sort(users),
									selected: node.getMetadata('id') || ''
								}
							}));

							if($('#user_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') == 'edit') ?
												{ id: $('#user_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.userPopupEdit({
									data: _data, 
									callback: function(_data) {
										node.setMetadata('id', _data.id || 'null');
										node.setMetadata('timeout', $('#parameter_input', popup_html).val());
										node.setMetadata('can_call_self', $('#user_can_call_self', popup_html).is(':checked'));

										node.caption = (_data.first_name || '') + ' ' + (_data.last_name || '');

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#user_selector', popup_html).val());
								node.setMetadata('timeout', $('#parameter_input', popup_html).val());
								node.setMetadata('can_call_self', $('#user_can_call_self', popup_html).is(':checked'));

								node.caption = $('#user_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.user.select_user,
								beforeClose: function() {
									if(typeof callback == 'function') {
										callback();
									}
								}
							});
						});
					},
					listEntities: function(callback) {
						self.callApi({
							resource: 'user.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.user.edit'
				},
				'hotdesk[action=login]': {
					name: self.i18n.active().callflows.user.hot_desk_login,
					icon: 'hotdesk_login',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_login_tip,
					data: {
						action: 'login'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 10,
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
							callback();
						}
					}
				},
				'hotdesk[action=logout]': {
					name: self.i18n.active().callflows.user.hot_desk_logout,
					icon: 'hotdesk_logout',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_logout_tip,
					data: {
						action: 'logout'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 20,
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
							callback();
						}
					}
				},
				'hotdesk[action=toggle]': {
					name: self.i18n.active().callflows.user.hot_desk_toggle,
					icon: 'hotdesk_toggle',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_toggle_tip,
					data: {
						action: 'toggle'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 30,
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
							callback();
						}
					}
				}
			});
		},

		userPopupEdit: function(args) {
			var self = this,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				popup,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html.css({
				height: 500,
				'overflow-y': 'scroll'
			});

			self.userEdit({
				data: data,
				parent: popup_html,
				target: $('.inline_content', popup_html),
				callbacks: {
					save_success: function(_data) {
						popup.dialog('close');

						if(typeof callback == 'function') {
							callback(_data);
						}
					},
					delete_success: function() {
						popup.dialog('close');

						if(typeof callback == 'function') {
							callback({ data: {} });
						}
					},
					after_render: function() {
						popup = monster.ui.dialog(popup_html, {
							title: (data.id) ? self.i18n.active().callflows.user.edit_user : self.i18n.active().callflows.user.create_user
						});
					}
				},
				data_defaults: data_defaults
			});
		},

		userEdit: function(args) {
			var self = this,
				data = args.data,
				parent = args.parent || $('#user-content'),
				target = args.target || $('#user-view', parent),
				_callbacks = args.callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success || function(_data) {
						self.userRenderList(parent);

						self.userEdit({
							data: { id: _data.data.id },
							parent: parent,
							target: target,
							callbacks: callbacks
						});
					},

					save_error: _callbacks.save_error,

					delete_success: _callbacks.delete_success || function() {
						target.empty();

						self.userRenderList(parent);
					},

					delete_error: _callbacks.delete_error,

					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						apps: {},
						call_forward: {
							substitute: true
						},
						call_restriction: {
							closed_groups: { action: 'inherit' }
						},
						caller_id: {
							internal: {},
							external: {},
							emergency: {}
						},
						hotdesk: {},
						contact_list: {
							exclude: false,
						},
						priv_level: 'user',
						music_on_hold: {},
						timezone: 'inherit'
					}, args.data_defaults || {}),
					field_data: {
						device_types: {
							sip_device: self.i18n.active().callflows.user.sip_device_type,
							cellphone: self.i18n.active().callflows.user.cell_phone_type,
							fax: self.i18n.active().callflows.user.fax_type,
							smartphone: self.i18n.active().callflows.user.smartphone_type,
							landline: self.i18n.active().callflows.user.landline_type,
							softphone: self.i18n.active().callflows.user.softphone_type,
							sip_uri: self.i18n.active().callflows.user.sip_uri_type
						},
						call_restriction: {}
					}
				};

			self.random_id = false;

			monster.parallel({
				list_classifiers: function(callback) {
					self.callApi({
						resource: 'numbers.listClassifiers',
						data: {
							accountId: self.accountId,
							filters: { paginate:false }
						},
						success: function(_data_classifiers, status) {
							if('data' in _data_classifiers) {
								$.each(_data_classifiers.data, function(k, v) {
									defaults.field_data.call_restriction[k] = {
										friendly_name: v.friendly_name
									};

									defaults.data.call_restriction[k] = { action: 'inherit' };
								});
							}
							callback(null, _data_classifiers);
						}
					});
				},
				media_list: function(callback) {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: { paginate:false }
						},
						success: function(_data, status) {
							if(_data.data) {
								_data.data.unshift(
									{
										id: '',
										name: self.i18n.active().callflows.user.default_music
									},
									{
										id: 'silence_stream://300000',
										name: self.i18n.active().callflows.user.silence
									}
								);
							}

							defaults.field_data.media = _data.data;

							callback(null, _data);
						}
					});
				},
				user_get: function(callback) {
					if(typeof data == 'object' && data.id) {
						self.userGet(data.id, function(_data, status) {
							self.userMigrateData(_data);

							callback(null, _data);
						});
					}
					else {
						self.random_id = $.md5(monster.util.randomString(10)+new Date().toString());
						defaults.field_data.new_user = self.random_id;

						callback(null, defaults);
					}
				},
				user_hotdesks: function(callback) {
					if(typeof data == 'object' && data.id) {
						self.callApi({
							resource: 'user.hotdesks',
							data: {
								accountId: self.accountId,
								userId: data.id
							},
							success: function(_data_devices) {
								defaults.field_data.hotdesk_enabled = true;
								defaults.field_data.device_list = {};

								$.each(_data_devices.data, function(k, v) {
									defaults.field_data.device_list[v.device_id] = { name: v.device_name };
								});

								if($.isEmptyObject(defaults.field_data.device_list)) {
									delete defaults.field_data.device_list;
								}

								callback(null, _data_devices);
							},
							error: function(_data, status) {
								//callback({api_name: 'Hotdesk'}, _data);
								callback(null, defaults);
							}
						})
					}
					else {
						callback(null, defaults);
					}
				}
			},
			function(err, results) {
				var render_data = defaults;
				if(typeof data === 'object' && data.id) {
					if(results.user_get.hasOwnProperty('call_restriction')) {
						$.each(results.user_get.call_restriction, function(k, v) {
							if (defaults.field_data.call_restriction.hasOwnProperty(k)) {
								defaults.field_data.call_restriction[k].action = v.action;
							}
						});
					}

					render_data = $.extend(true, defaults, { data: results.user_get });
				}

				self.userRender(render_data, target, callbacks);

				if(typeof callbacks.after_render == 'function') {
					callbacks.after_render();
				}
			});
		},

		userRender: function(data, target, callbacks) {
			var self = this,
				user_html = $(monster.template(self, 'user-edit', data)),
				user_form = user_html.find('#user-form'),
				data_devices,
				hotdesk_pin = $('.hotdesk_pin', user_html),
				hotdesk_pin_require = $('#hotdesk_require_pin', user_html);

			self.userRenderDeviceList(data, user_html);

			monster.ui.validate(user_form, {
				rules: {
					username: {
						required: true,
						minlength: 3,
						regex: /^[0-9a-zA-Z+@._-]*$/
					},
					first_name: {
						required: true,
						minlength: 1,
						maxlength: 256,
						regex: /^[0-9a-zA-Z\s\-\']+$/
					},
					last_name: {
						required: true,
						minlength: 1,
						maxlength: 256,
						regex: /^[0-9a-zA-Z\s\-\']+$/
					},
					email: {
						required: true,
						email: true
					},
					pwd_mngt_pwd1: {
						required: true,
						minlength: 3
					},
					pwd_mngt_pwd2: {
						required: true,
						minlength: 3,
						equalTo: '#pwd_mngt_pwd1'
					},
					'hotdesk.pin': { regex: /^[0-9]*$/ },
					'hotdesk.id': { regex: /^[0-9\+\#\*]*$/ },
					call_forward_number: { regex: /^[\+]?[0-9]*$/ },
					'caller_id.internal.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
					'caller_id.external.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
					'caller_id.internal.number': { regex: /^[\+]?[0-9\s\-\.\(\)]*$/ },
					'caller_id.external.number': { regex: /^[\+]?[0-9\s\-\.\(\)]*$/ },
					'caller_id.emergency.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
					'caller_id.emergency.number': { regex: /^[\+]?[0-9\s\-\.\(\)]*$/ }
				},
				messages: {
					username: { regex: self.i18n.active().callflows.user.validation.username },
					first_name: { regex: self.i18n.active().callflows.user.validation.name },
					last_name: { regex: self.i18n.active().callflows.user.validation.name },
					'hotdesk.pin': { regex: self.i18n.active().callflows.user.validation.hotdesk.pin },
					'hotdesk.id': { regex: self.i18n.active().callflows.user.validation.hotdesk.id },
					'caller_id.internal.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
					'caller_id.external.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
					'caller_id.emergency.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
					'caller_id.internal.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
					'caller_id.external.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
					'caller_id.emergency.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number }
				}
			});

			timezone.populateDropdown($('#timezone', user_html), data.data.timezone||'inherit', {inherit: self.i18n.active().defaultTimezone});

			if (data.data.id === monster.apps.auth.userId){
				$('.user-delete', user_html).hide();
			}

			$('*[rel=popover]:not([type="text"])', user_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', user_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(user_html);
			self.winkstartLinkForm(user_html);

			hotdesk_pin_require.is(':checked') ? hotdesk_pin.show() : hotdesk_pin.hide();

			hotdesk_pin_require.change(function() {
				$(this).is(':checked') ? hotdesk_pin.show('blind') : hotdesk_pin.hide('blind');
			});

			$('.user-save', user_html).click(function(ev) {
				ev.preventDefault();

				var $this = $(this);

				if(!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(user_form)) {
						var form_data = monster.ui.getFormData('user-form');

						if(form_data.enable_pin === false) {
							delete data.data.queue_pin;
							delete data.data.record_call;
						}

						self.userCleanFormData(form_data);

						if('field_data' in data) {
							delete data.field_data;
						}

						self.callApi({
							resource: 'account.get',
							data: {
								accountId: self.accountId
							},
							success: function(_data, status) {
								if(form_data.priv_level == 'admin') {
									form_data.apps = form_data.apps || {};
									if(!('voip' in form_data.apps) && $.inArray('voip', (_data.data.available_apps || [])) > -1) {
										form_data.apps['voip'] = {
											label: self.i18n.active().callflows.user.voip_services_label,
											icon: 'device',
											api_url: monster.config.api.default
										}
									}
								}
								else if(form_data.priv_level == 'user' && $.inArray('userportal', (_data.data.available_apps || [])) > -1) {
									form_data.apps = form_data.apps || {};
									if(!('userportal' in form_data.apps)) {
										form_data.apps['userportal'] = {
											label: self.i18n.active().callflows.user.user_portal_label,
											icon: 'userportal',
											api_url: monster.config.api.default
										}
									}
								}

								self.userSave(form_data, data, function(data, status, action) {
									if(action == 'create') {
										self.userAcquireDevice(data, function() {
											if(typeof callbacks.save_success == 'function') {
												callbacks.save_success(data, status, action);
											}
										}, function() {
											if(typeof callbacks.save_error == 'function') {
												callbacks.save_error(data, status, action);
											}
										});
									}
									else {
										if(typeof callbacks.save_success == 'function') {
											callbacks.save_success(data, status, action);
										}
									}
								// }, winkstart.error_message.process_error(callbacks.save_error));
								});
							}
						});
					}
					else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.user.there_were_errors_on_the_form);
					}
				}
			});

			$('.user-delete', user_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.user.are_you_sure_you_want_to_delete, function() {
					self.userDelete(data.data.id, callbacks.delete_success, callbacks.delete_error);
				});
			});

			if(!$('#music_on_hold_media_id', user_html).val()) {
				$('#edit_link_media', user_html).hide();
			}

			$('#music_on_hold_media_id', user_html).change(function() {
				!$('#music_on_hold_media_id option:selected', user_html).val() ? $('#edit_link_media', user_html).hide() : $('#edit_link_media', user_html).show();
			});

			$('.inline_action_media', user_html).click(function(ev) {
				var _data = ($(this).data('action') == 'edit') ? { id: $('#music_on_hold_media_id', user_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();
				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(media) {
						/* Create */
						if(!_id) {
							$('#music_on_hold_media_id', user_html).append('<option id="'+ media.id  +'" value="'+ media.id +'">'+ media.name +'</option>')
							$('#music_on_hold_media_id', user_html).val(media.id);

							$('#edit_link_media', user_html).show();
						}
						else {
							/* Update */
							if(media.hasOwnProperty('id')) {
								$('#music_on_hold_media_id #'+ media.id, user_html).text(media.name);
							}
							/* Delete */
							else {
								$('#music_on_hold_media_id #'+_id, user_html).remove();
								$('#edit_link_media', user_html).hide();
							}
						}
					}
				});
			});

			$(user_html).delegate('.enabled_checkbox', 'click', function() {
				self.userUpdateSingleDevice($(this), user_html);
			});

			$(user_html).delegate('.action_device.edit', 'click', function() {
				var data_device = {
					id: $(this).data('id'),
					hide_owner: !data.data.id ? true : false
				};

				var defaults = {};

				if(!data.data.id) {
					defaults.new_user = self.random_id;
				}
				else {
					defaults.owner_id = data.data.id;
				}

				monster.pub('callflows.device.popupEdit', {
					data: data_device,
					callback: function(_data) {
						data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = _data.data.new_user ? { new_user: true, id: self.random_id } : { id: data.data.id };

						self.userRenderDeviceList(data_devices, user_html);
					},
					data_defaults: defaults
				});
			});

			$(user_html).delegate('.action_device.delete', 'click', function() {
				var device_id = $(this).data('id');
				monster.ui.confirm(self.i18n.active().callflows.user.do_you_really_want_to_delete, function() {
					self.userDeleteDevice(device_id, function() {
						data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = self.random_id ? { new_user: true, id: self.random_id } : { id: data.data.id };

						self.userRenderDeviceList(data_devices, user_html);
					});
				});
			});

			$('.add_device', user_html).click(function(ev) {
				var data_device = {
						hide_owner: true
					},
					defaults = {};

				ev.preventDefault();

				if(!data.data.id) {
					defaults.new_user = self.random_id;
				}
				else {
					defaults.owner_id = data.data.id;
				}

				monster.pub('callflows.device.popupEdit', {
					data: data_device,
					callback: function(_data) {
						var data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = self.random_id ? { new_user: true, id: self.random_id } : { id: data.data.id };

						self.userRenderDeviceList(data_devices, user_html);
					},
					data_defaults: defaults
				});
			});

			(target)
				.empty()
				.append(user_html);
		},

		userRenderList: function(parent, callback) {
			var self = this;

			self.userList(function(data, status) {
					var map_crossbar_data = function(data) {
						var new_list = [];

						if(data.length > 0) {
							$.each(data, function(key, val) {
								new_list.push({
									id: val.id,
									title: (val.first_name && val.last_name) ?
											   val.last_name + ', ' + val.first_name :
											   '(no name)'
								});
							});
						}

						new_list.sort(function(a, b) {
							return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
						});

						return new_list;
					};

					// $('#user-listpanel', parent)
					// 	.empty()
					// 	.listpanel({
					// 		label: _t('user', 'users_label'),
					// 		identifier: 'user-listview',
					// 		new_entity_label: _t('user', 'add_user_label'),
					// 		data: map_crossbar_data(data.data),
					// 		publisher: monster.pub,
					// 		notifyMethod: 'callflows.user.edit',
					// 		notifyCreateMethod: 'callflows.user.edit',
					// 		notifyParent: parent
					// 	});

					callback && callback();
				}
			);
		},

		userRenderDeviceList: function(data, parent) {
			var self = this,
				parent = $('#tab_devices', parent);

			if(data.data.id) {
				var filter = data.data.new_user ? { filter_new_user: data.data.id } : { filter_owner_id: data.data.id };

				self.userListDevice(filter, function(_data, status) {
					$('.rows', parent).empty();
					if(_data.length > 0) {
						$.each(_data, function(k, v) {
							v.display_type = data.field_data.device_types[v.device_type];
							v.not_enabled = this.enabled === false ? true : false;
							$('.rows', parent).append($(monster.template(self, 'user-deviceRow', v)));
						});

						self.callApi({
							resource: 'device.getStatus',
							data: {
								accountId: self.accountId
							},
							success: function(_data, status) {
								$.each(_data.data, function(key, val) {
									$('#' + val.device_id + ' .column.third', parent).addClass('registered');
								});
							}
						});
					}
					else {
						$('.rows', parent).append($(monster.template(self, 'user-deviceRow')));
					}
				});
			}
			else {
				$('.rows', parent).empty()
								  .append($(monster.template(self, 'user-deviceRow')));
			}
		},

		userMigrateData: function(data) {
			if(!('priv_level' in data)) {
				if('apps' in data && 'voip' in data.apps) {
					data.priv_level = 'admin';
				} else {
					data.priv_level = 'user';
				}
			}

			return data;
		},

		userUpdateSingleDevice: function($checkbox, parent) {
			$checkbox.attr('disabled', 'disabled');

			var self = this,
				device_id = $checkbox.data('device_id'),
				enabled = $checkbox.is(':checked');

			self.userGetDevice(device_id, function(_data) {
					if($.inArray(_data.device_type, ['cellphone', 'smartphone', 'landline']) > -1) {
						_data.call_forward.enabled = enabled;
					}
					_data.enabled = enabled;
					self.userUpdateDevice(device_id, _data, function(_data) {
							$checkbox.removeAttr('disabled');
							if(_data.enabled === true) {
								$('#'+ _data.id + ' .column.third', parent).removeClass('disabled');
							}
							else {
								$('#'+ _data.id + ' .column.third', parent).addClass('disabled');
							}
						},
						function() {
							$checkbox.removeAttr('disabled');
							enabled ? $checkbox.removeAttr('checked') : $checkbox.attr('checked', 'checked');
						}
					);
				},
				function() {
					$checkbox.removeAttr('disabled');
					enabled ? $checkbox.removeAttr('checked') : $checkbox.attr('checked', 'checked');
				}
			);
		},

		userAcquireDevice: function(user_data, success, error) {
			var self = this,
				user_id = user_data.id;

			if(self.random_id) {
				self.userListDevice({ filter_new_user: self.random_id }, function(_data, status) {
					var device_id;
					var array_length = _data.length;
					if(array_length != 0) {
						$.each(_data, function(k, v) {
							device_id = this.id;
							self.userGetDevice(device_id, function(_data, status) {
								_data.owner_id = user_id;
								delete _data.new_user;
								self.userUpdateDevice(device_id, _data, function(_data, status) {
									if(k == array_length - 1) {
										success({}, status, 'create');
									}
								});
							});
						});
					}
					else {
						success({}, status, 'create');
					}
				});
			}
			else {
				success({}, status, 'create');
			}
		},

		userCleanFormData: function(form_data){
			form_data.caller_id.internal.number = form_data.caller_id.internal.number.replace(/\s|\(|\)|\-|\./g,'');
			form_data.caller_id.external.number = form_data.caller_id.external.number.replace(/\s|\(|\)|\-|\./g,'');
			form_data.caller_id.emergency.number = form_data.caller_id.emergency.number.replace(/\s|\(|\)|\-|\./g,'');

			form_data.call_restriction.closed_groups = { action: form_data.extra.closed_groups ? 'deny' : 'inherit' };

			if(!form_data.hotdesk.require_pin) {
				delete form_data.hotdesk.pin;
			}

			if(form_data.pwd_mngt_pwd1 != 'fakePassword') {
				form_data.password = form_data.pwd_mngt_pwd1;
			}

			delete form_data.pwd_mngt_pwd1;
			delete form_data.pwd_mngt_pwd2;
			delete form_data.extra;

			return form_data;
		},

		userSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.userNormalizeData($.extend(true, {}, data.data, form_data));

			if(typeof data.data == 'object' && data.data.id) {
				self.userUpdate(normalized_data, function(_data, status) {
						if(typeof success == 'function') {
							success(_data, status, 'update');
						}
					},
					function(_data, status) {
						if(typeof error == 'function') {
							error(_data, status, 'update');
						}
					}
				);
			}
			else {
				self.userCreate(normalized_data, function(_data, status) {
						if(typeof success == 'function') {
							success(_data, status, 'create');
						}
					},
					function(_data, status) {
						if(typeof error == 'function') {
							error(_data, status, 'create');
						}
					}
				);
			}
		},

		userNormalizeData: function(data) {
			if($.isArray(data.directories)) {
				data.directories = {};
			}

			$.each(data.caller_id, function(key, val) {
				$.each(val, function(_key, _val) {
					if(_val == '') {
						delete val[_key];
					}
				});

				if($.isEmptyObject(val)) {
					delete data.caller_id[key];
				}
			});

			if($.isEmptyObject(data.caller_id)) {
				delete data.caller_id;
			}

			if(!data.music_on_hold.media_id) {
				delete data.music_on_hold.media_id;
			}

			if(data.hotdesk.hasOwnProperty("enable")) {
				delete data.hotdesk.enable;
			}

			if(data.hotdesk.hasOwnProperty('log_out')) {
				var new_endpoint_ids = [];

				$.each(data.hotdesk.endpoint_ids, function(k, v) {
					if(data.hotdesk.log_out.indexOf(v) < 0) {
						new_endpoint_ids.push(v);
					}
				});

				data.hotdesk.endpoint_ids = new_endpoint_ids;

				delete data.hotdesk.log_out;
			}

			if(data.hotdesk.hasOwnProperty('endpoint_ids') && data.hotdesk.endpoint_ids.length === 0) {
				delete data.hotdesk.endpoint_ids;
			}

			if(data.hasOwnProperty('call_forward') && data.call_forward.number === '') {
				delete data.call_forward.number;
			}

			if(data.hasOwnProperty('presence_id') && data.presence_id === '') {
				delete data.presence_id;
			}

			if(data.timezone && data.timezone === 'inherit') {
				delete data.timezone;
			}

			return data;
		},


		userList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userGet: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userDelete: function(userId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'user.delete',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(error) {
					callbackError && callbackError();
				}
			});
		},

		userListDevice: function(pFilters, callback) {
			var self = this,
				filters = $.extend(true, pFilters, { paginate: false });

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data) {
					callback && callback(data.data);
				}
			})
		},

		userGetDevice: function(deviceId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError();
				}
			})
		},

		userUpdateDevice: function(deviceId, data, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					deviceId: deviceId,
					data: data
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function() {
					callbackError && callbackError();
				}
			});
		},

		userDeleteDevice: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function() {
					callback && callback();
				}
			});
		}
	};

	return app;
});
