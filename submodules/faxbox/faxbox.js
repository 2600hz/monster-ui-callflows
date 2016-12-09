define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'faxboxDefineActions',
			'callflows.faxbox.edit': '_faxboxEdit'
		},

		faxboxDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'faxbox[id=*]': {
					name: self.i18n.active().callflows.faxbox.faxboxes_label,
					icon: 'printer2',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'faxbox',
					tip: self.i18n.active().callflows.faxbox.faxbox_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 130,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if(id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this;

						self.faxboxList(function(data, status) {
							var popup_html = $(monster.template(self, 'faxbox-callflowEdit', {
									items: monster.util.sort(data),
									selected: node.getMetadata('id') || ''
								})),
								popup;

							if($('#faxbox_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') == 'edit') ?
												{ id: $('#faxbox_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.faxboxPopupEdit({
									data: _data,
									callback: function(_data) {
										node.setMetadata('id', _data.id || 'null');

										node.caption = _data.name || '';

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#faxbox_selector', popup_html).val());

								node.caption = $('#faxbox_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.faxbox.voicemail_title,
								minHeight: '0',
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
							resource: 'faxbox.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.faxbox.edit'
				}
			});
		},

		faxboxPopupEdit: function(args) {
			var self = this,
				popup_html = popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults || {},
				popup;

			self.faxboxEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if ( typeof callback == 'function' ) {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if ( typeof callback == 'function' ) {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = monster.ui.dialog(popup_html, {
						title: self.i18n.active().callflows.faxbox[(data.id ? 'edit' : 'create').concat('_faxbox')]
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring faxboxEdit
		_faxboxEdit: function(args) {
			var self = this;
			self.faxboxEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		faxboxEdit: function(data, _parent, _target, _callbacks) {
			var self = this,
				parent = _parent || $('#faxbox-content'),
				target = _target || $('#faxbox-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success || function(_data) {
							self.faxboxRenderList(parent);

							self.faxboxEdit({ id: _data.id }, parent, target, callbacks);
					},
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success || function() {
						target.empty();

						self.faxboxRenderList(parent);
					},
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				};

			monster.parallel({
					faxbox: function(callback) {
						if (typeof data === 'object' && data.id) {
							self.faxboxGet(data.id, function(_data, status) {
								_data.id = data.id;

								callback(null, _data);
							});
						} else {
							callback(null, {});
						}
					},
					user_list: function(callback) {
						self.callApi({
							resource: 'user.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(_data, status) {
								_data.data.sort(function(a, b){
									if(a.hasOwnProperty('first_name') && a.hasOwnProperty('last_name') && b.hasOwnProperty('first_name') && b.hasOwnProperty('last_name')) {
										return a.first_name.concat(' ', a.last_name).toLowerCase() > b.first_name.concat(' ', b.last_name).toLowerCase() ? 1 : -1;
									}
									else {
										return 1;
									}
								});

								_data.data.unshift({
									id: '',
									first_name: self.i18n.active().callflows.faxbox.no,
									last_name: self.i18n.active().callflows.faxbox.owner
								});

								callback(null, _data.data);
							}
						});
					},
					current_user: function(callback) {
						if (!monster.util.isMasquerading()) {
							self.faxboxGetUser(self.userId, function(_data, status) {
								callback(null, _data);
							});
						}
						else {
							callback(null, {});
						}
					}
				},
				function(err, results) {
					if (!data.hasOwnProperty('id')) {
						if (_.size(results.current_user) === 0) {
							results.faxbox = $.extend(true, self.faxboxGetDefaultSettings(), results.faxbox);
						}
						else {
							results.faxbox = $.extend(true, self.faxboxGetDefaultSettings(results.current_user), results.faxbox);
						}
					}

					delete results.current_user;

					self.faxboxRender(results, target, callbacks);

					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}
				}
			);
		},

		faxboxRender: function(data, target, callbacks) {
			var self = this,
				faxbox_html = $(monster.template(self, 'faxbox-edit', {
					faxbox: self.faxboxNormalizedData(data.faxbox),
					users: data.user_list
				}));

			timezone.populateDropdown($('#fax_timezone', faxbox_html), data.faxbox.fax_timezone||'inherit', {inherit: self.i18n.active().defaultTimezone});

			$('*[rel=popover]:not([type="text"])', faxbox_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', faxbox_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(faxbox_html);

			if (!data.faxbox.hasOwnProperty('id')) {
				$('#owner_id', faxbox_html).change(function(ev) {
					if ($(this).val()) {
						self.faxboxGetUser($(this).val(),function(_data, status) {
							data.faxbox = self.faxboxGetDefaultSettings(_data);
							$('#edit_link', faxbox_html).show();
							self.faxboxRender(data, target, callbacks);
						});
					} else {
						data.faxbox = self.faxboxGetDefaultSettings();
						$('#edit_link', faxbox_html).hide();
						self.faxboxRender(data, target, callbacks);
					}
				});
			}
			else {
				$('#owner_id', faxbox_html).change(function(ev) {
					var currentFaxbox = monster.ui.getFormData('faxbox_form');

					if ($(this).val()) {
						$('[id$="bound_notification_email"]', faxbox_html).each(function(idx, el) {
							$(el).attr('disabled', true);
						});

						self.faxboxGetUser($(this).val(), function(_data, status) {
							data.faxbox = $.extend(true, {}, self.faxboxGetDefaultSettings(), data.faxbox, currentFaxbox, {
								cloud_connector_claim_url: faxbox_html.find('#cloud_connector_claim_url').attr('href'),
								notifications: {
									inbound: {
										email: {
											send_to: _data.email || _data.username
										}
									},
									outbound: {
										email: {
											send_to: _data.email || _data.username
										}
									}
								}
							});

							$('#edit_link', faxbox_html).hide();
							self.faxboxRender(data, target, callbacks);
						});
					}
					else {
						$('[id$="bound_notification_email"]', faxbox_html).each(function(idx, el) {
							$(el).attr('disabled', false);
						});
					}
				});
			}

			if(!$('#owner_id', faxbox_html).val()) {
				$('#edit_link', faxbox_html).hide();
			}

			$('.inline-action', faxbox_html).click(function(ev) {
				var _data = $(this).data('action') == 'edit' ? { id: $('#owner_id', faxbox_html).val() } : {},
					_id = _data.id;

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callflow: function(_data) {
						/* Create */
						if(!_id) {
							$('#owner_id', faxbox_html).append('<option id="'+ _data.id  +'" value="'+ _data.id +'">'+ _data.first_name + ' ' + _data.last_name  +'</option>')
							$('#owner_id', faxbox_html).val(_data.id);
						}
						else {
							/* Update */
							if('id' in _data) {
								$('#owner_id #'+_data.id, faxbox_html).text(_data.first_name + ' ' + _data.last_name);
							}
							/* Delete */
							else {
								$('#owner_id #'+_id, faxbox_html).remove();
							}
						}
					}
				});
			});

			$('#caller_id', faxbox_html).change(function(ev) {
				var number = $(this).val(),
					fax_identity = $('#fax_identity', faxbox_html);

				if (/^(\+1|1)([0-9]{10})$|^([0-9]{10})$/.test(number)) {
					if (/^(\+1)/.test(number)) {
						fax_identity.val(number.replace(/^\+1([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					} else if (/^1([0-9]{10})$/.test(number)) {
						fax_identity.val(number.replace(/^1([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					} else  {
						fax_identity.val(number.replace(/^([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					}
				} else {
					fax_identity.val('');
				}
			});

			$('.faxbox-save', faxbox_html).click(function(ev) {
				ev.preventDefault();

				var form_html = $('#faxbox_form', faxbox_html),
					form_data = monster.ui.getFormData('faxbox_form'),
					word_reg = /^[\w\s'-]+/

				monster.ui.validate(form_html, {
					rules: {
						name: {
							required: true
						},
						'caller_name': {
							regex: word_reg
						},
						'fax_header': {
							regex: word_reg
						},
						retries: {
							regex: /^[0-4]/
						}
					},
					messages: {
						'caller_name': {
							regex: self.i18n.active().callflows.faxbox.validation.words
						},
						'fax_header': {
							regex: self.i18n.active().callflows.faxbox.validation.words
						},
						retries: {
							regex: 'Please enter a numeric value between 0 and 4'
						}
					}
				});

				var $this = $(this);

				if(!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(form_html)) {
						self.faxboxSave(form_data, data.faxbox, function(data) {
							$this.removeClass('disabled');
							callbacks && callbacks.hasOwnProperty('save_success') && callbacks.save_success(data);
						}, function(data) {
							$this.removeClass('disabled');
							callbacks && callbacks.hasOwnProperty('save_error') && callbacks.save_error(data);
						});
					}
					else {
						$this.removeClass('disabled');
					}
				}
			});

			$('.faxbox-delete', faxbox_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.faxbox.are_you_sure_you_want_to_delete, function() {
					self.faxboxDelete(data.faxbox, callbacks.delete_success, callbacks.delete_error);
				});
			});

			target
				.empty()
				.append(faxbox_html);
		},

		faxboxRenderList: function(parent) {
			var self = this;

			self.faxboxList(function(data, status) {
				var map_crossbar_data = function(data) {
					var new_list = [];

					if(data.length > 0) {
						$.each(data, function(key, val) {
							new_list.push({
								id: val.id,
								title: val.name || self.i18n.active().callflows.faxbox.no_name
							});
						});
					}

					new_list.sort(function(a, b) {
						return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
					});

					return new_list;
				};
			});
		},

		faxboxGetDefaultSettings: function(user) {
			var self = this,
				default_faxbox = {
					name: '',
					caller_name: '',
					fax_header: '',
					fax_timezone: 'inherit',
					retries: 1,
					notifications: {
						inbound: {
							email: {
								send_to: ''
							}
						},
						outbound: {
							email: {
								send_to: ''
							}
						}
					}
				};

			if (typeof user === 'undefined') {
				return default_faxbox;
			} else {
				return $.extend(true, {}, default_faxbox, {
							name: user.first_name.concat(' ', user.last_name, self.i18n.active().callflows.faxbox.default_settings_name_extension),
							caller_name: user.first_name.concat(' ', user.last_name),
							fax_header: monster.config.whitelabel.companyName.concat(self.i18n.active().callflows.faxbox.default_settings_header_extension),
							owner_id: user.id,
							notifications: {
								inbound: {
									email: {
										send_to: user.email || user.username
									}
								},
								outbound: {
									email: {
										send_to: user.email || user.username
									}
								}
							}
						}
					);
			}
		},

		faxboxSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.faxboxNormalizedData($.extend(true, {}, data, form_data));

			if(typeof data == 'object' && data.id) {
				self.faxboxUpdate(normalized_data, function(_data, status) {
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
			} else {
				self.faxboxCreate(normalized_data, function(_data, status) {
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

		faxboxNormalizedData: function(form_data) {
			if (form_data.hasOwnProperty('notifications')) {
				if(form_data.notifications.hasOwnProperty('inbound') && form_data.notifications.inbound.hasOwnProperty('email')) {
					var inbound = form_data.notifications.inbound.email.send_to;
					form_data.notifications.inbound.email.send_to = inbound instanceof Array ? inbound.join(',') : inbound.replace(/\s/g, '').split(',');
				}

				if(form_data.notifications.hasOwnProperty('outbound') && form_data.notifications.outbound.hasOwnProperty('email')) {
					var outbound = form_data.notifications.outbound.email.send_to;
					form_data.notifications.outbound.email.send_to = outbound instanceof Array ? outbound.join(',') : outbound.replace(/\s/g, '').split(',');
				}
			}

			if (form_data.hasOwnProperty('smtp_permission_list')) {
				if (form_data.smtp_permission_list === '') {
					delete form_data.smtp_permission_list;
				} else {
					var list = form_data.smtp_permission_list;

					form_data.smtp_permission_list  = list instanceof Array ? list.join(',') : list.replace(/\s/g, '').split(',');
				}
			}

			if (form_data.hasOwnProperty('custom_smtp_email_address') && form_data.custom_smtp_email_address === '') {
				delete form_data.custom_smtp_email_address;
			}

			if (form_data.hasOwnProperty('owner_id') && form_data.owner_id === '') {
				delete form_data.owner_id;
			}

			if(form_data.fax_timezone && form_data.fax_timezone === 'inherit') {
				delete form_data.fax_timezone;
			}

			return form_data;
		},

		faxboxList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxGet: function(faxboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.get',
				data: {
					accountId: self.accountId,
					faxboxId: faxboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxUpdate: function(data, callback) {
			var self = this;
			
			self.callApi({
				resource: 'faxbox.update',
				data: {
					accountId: self.accountId,
					faxboxId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxDelete: function(data, callbackSuccess, callbackError) {
			var self = this;

			if (typeof data === 'object' && data.hasOwnProperty('id')) {
				self.callApi({
					resource: 'faxbox.delete',
					data: {
						accountId: self.accountId,
						faxboxId: data.id
					},
					success: function(data) {
						callbackSuccess && callbackSuccess(data.data);
					},
					error: function(error) {
						callbackError && callbackError();
					}
				});
			}
		},

		faxboxGetUser: function(userId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data, status) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data, status) {
					callbackError && callbackError();
				}
			});
		}
	};

	return app;
});
