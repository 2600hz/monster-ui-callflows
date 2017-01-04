define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'vmboxDefineActions',
			'callflows.vmbox.edit': '_vmboxEdit'
		},

		vmboxPopupEdit: function(args) {
			var self = this,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults || {},
				popup,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			self.vmboxEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.vmbox.edit_voicemail_box_title : self.i18n.active().callflows.vmbox.create_voicemail_box_title
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring vmboxEdit
		_vmboxEdit: function(args) {
			var self = this;
			self.vmboxEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		vmboxEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#vmbox-content'),
				target = _target || $('#vmbox-view', parent),
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
						require_pin: true,
						check_if_owner: true,
						pin: '',
						media: {},
						timezone: 'inherit'
					}, data_defaults || {}),

					field_data: {
						users: [],
						media: []
					}
				};

			monster.parallel({
				media_list: function(callback) {
					self.vmboxMediaList(function(_data) {
						_data.unshift({
							id: '',
							name: self.i18n.active().callflows.vmbox.not_set
						});

						defaults.field_data.media = _data;

						callback(null, _data);
					});
				},
				user_list: function(callback) {
					self.vmboxUserList(function(_data) {
						_data.unshift({
							id: '',
							first_name: self.i18n.active().callflows.vmbox.no,
							last_name: self.i18n.active().callflows.vmbox.owner
						});

						defaults.field_data.users = _data;

						callback(null, _data);
					});
				},
				get_vmbox: function(callback) {
					if(typeof data == 'object' && data.id) {
						self.vmboxGet(data.id, function(_data) {
							callback(null, _data);
						});
					}
					else {
						callback(null, {});
					}
				}
			},
			function(err, results) {
				var render_data = defaults;

				if(typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, { data: results.get_vmbox });
				}

				self.vmboxRender(render_data, target, callbacks);

				if(typeof callbacks.after_render == 'function') {
					callbacks.after_render();
				}
			});
		},

		vmboxRender: function(data, target, callbacks) {
			var self = this,
				vmbox_html = $(monster.template(self, 'vmbox-edit', data)),
				vmboxForm = vmbox_html.find('#vmbox-form');

			timezone.populateDropdown($('#timezone', vmbox_html), data.data.timezone||'inherit', {inherit: self.i18n.active().defaultTimezone});

			monster.ui.validate(vmboxForm, {
				rules: {
					'mailbox': {
						required: true,
						digits: true
					},
					'pin': {
						digits: true,
						minlength: 4
					},
					'name': {
						required: true
					}
				}
			});

			$('*[rel=popover]:not([type="text"])', vmbox_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', vmbox_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(vmbox_html);


			$('#owner_id', vmbox_html).change(function() {
				if($(this).val()) {
					self.callApi({
						resource: 'user.get',
						data: {
							accountId: self.accountId,
							userId: $(this).val()
						},
						success: function(data) {
							if('timezone' in data.data) {
								$('#timezone', vmbox_html).val(data.data.timezone);
							}
						}
					});
				}
			});

			if(!$('#owner_id', vmbox_html).val()) {
				$('#edit_link', vmbox_html).hide();
			}

			$('#owner_id', vmbox_html).change(function() {
				if(!$('#owner_id option:selected', vmbox_html).val()) {
					$('#edit_link', vmbox_html).hide();
					$('#timezone', vmbox_html).val(timezone.getLocaleTimezone());
				}
				else {
					 $('#edit_link', vmbox_html).show();
				}
			});

			$('.inline_action', vmbox_html).click(function(ev) {
				var _data = ($(this).data('action') == 'edit') ? { id: $('#owner_id', vmbox_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callback: function(_data) {
						console.log(_data);
						/* Create */
						if(!_id) {
							$('#owner_id', vmbox_html).append('<option id="'+ _data.id  +'" value="'+ _data.id +'">'+ _data.first_name + ' ' + _data.last_name  +'</option>')
							$('#owner_id', vmbox_html).val(_data.id);

							$('#edit_link', vmbox_html).show();
							$('#timezone', vmbox_html).val(_data.timezone);
						}
						else {
							/* Update */
							if('id' in _data) {
								$('#owner_id #'+_data.data.id, vmbox_html).text(_data.first_name + ' ' + _data.last_name);
								$('#timezone', vmbox_html).val(_data.timezone);
							}
							/* Delete */
							else {
								$('#owner_id #'+_id, vmbox_html).remove();
								$('#edit_link', vmbox_html).hide();
								$('#timezone', vmbox_html).val('America/Los_Angeles');
							}
						}
					}
				});
			});

			if(!$('#media_unavailable', vmbox_html).val()) {
				$('#edit_link_media', vmbox_html).hide();
			}

			$('#media_unavailable', vmbox_html).change(function() {
				!$('#media_unavailable option:selected', vmbox_html).val() ? $('#edit_link_media', vmbox_html).hide() : $('#edit_link_media', vmbox_html).show();
			});

			$('.inline_action_media', vmbox_html).click(function(ev) {
				var _data = ($(this).data('action') == 'edit') ? { id: $('#media_unavailable', vmbox_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(_data) {
						/* Create */
						if(!_id) {
							$('#media_unavailable', vmbox_html).append('<option id="'+ _data.data.id  +'" value="'+ _data.data.id +'">'+ _data.data.name +'</option>')
							$('#media_unavailable', vmbox_html).val(_data.data.id);

							$('#edit_link_media', vmbox_html).show();
						}
						else {
							/* Update */
							if('id' in _data.data) {
								$('#media_unavailable #'+_data.data.id, vmbox_html).text(_data.data.name);
							}
							/* Delete */
							else {
								$('#media_unavailable #'+_id, vmbox_html).remove();
								$('#edit_link_media', vmbox_html).hide();
							}
						}
					}
				});
			});


			$('.vmbox-save', vmbox_html).click(function(ev) {
				ev.preventDefault();

				var $this = $(this);

				if(!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if(monster.ui.valid(vmboxForm)) {
						var form_data = monster.ui.getFormData('vmbox-form');

						/* self.clean_form_data(form_data); */

						if('field_data' in data) {
							delete data.field_data;
						}

						self.vmboxSave(form_data, data, callbacks.save_success);
					}
					else {
						$this.removeClass('disabled');
					}
				}
			});

			$('.vmbox-delete', vmbox_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.vmbox.are_you_sure_you_want_to_delete, function() {
					self.vmboxDelete(data.data.id, callbacks.delete_success);
				});
			});

			(target)
				.empty()
				.append(vmbox_html);
		},

		vmboxSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.vmboxNormalizeData($.extend(true, {}, data.data, form_data));

			if(typeof data.data == 'object' && data.data.id) {
				self.vmboxUpdate(normalized_data, function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status, 'update');
					}
				});
			}
			else {
				self.vmboxCreate(normalized_data, function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status, 'create');
					}
				});
			}
		},

		vmboxNormalizeData: function(form_data) {
			if(!form_data.owner_id) {
				delete form_data.owner_id;
			}

			if(!form_data.media.unavailable) {
				delete form_data.media.unavailable;
			}

			if(form_data.pin === '') {
				delete form_data.pin;
			}

			if(form_data.timezone && form_data.timezone === 'inherit') {
				delete form_data.timezone;
			}

			form_data.not_configurable = !form_data.extra.allow_configuration;

			delete form_data.extra;

			return form_data;
		},

		vmboxDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				getVoicemailNode = function(hasCategory) {
					var action = {
						name: self.i18n.active().callflows.vmbox.voicemail,
						icon: 'voicemail',
						module: 'voicemail',
						tip: self.i18n.active().callflows.vmbox.voicemail_tip,
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
						weight: 50,
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

							self.vmboxList(function(data) {
									var popup, popup_html;

									popup_html = $(monster.template(self, 'vmbox-callflowEdit', {
										items: monster.util.sort(data),
										selected: node.getMetadata('id') || ''
									}));

									if($('#vmbox_selector option:selected', popup_html).val() == undefined) {
										$('#edit_link', popup_html).hide();
									}

									$('.inline_action', popup_html).click(function(ev) {
										var _data = ($(this).data('action') == 'edit') ?
														{ id: $('#vmbox_selector', popup_html).val() } : {};

										ev.preventDefault();

										self.vmboxPopupEdit({
											data: _data, 
											callback: function(vmbox) {
												node.setMetadata('id', vmbox.id || 'null');

												node.caption = vmbox.name || '';

												popup.dialog('close');
											}
										});
									});

									$('#add', popup_html).click(function() {
										node.setMetadata('id', $('#vmbox_selector', popup_html).val());

										node.caption = $('#vmbox_selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.vmbox.voicemail_title,
										minHeight: '0',
										beforeClose: function() {
											if(typeof callback == 'function') {
												callback();
											}
										}
									});
								}
							);
						},
						listEntities: function(callback) {
							self.callApi({
								resource: 'voicemail.list',
								data: {
									accountId: self.accountId,
									filters: { paginate:false }
								},
								success: function(data, status) {
									callback && callback(data.data);
								}
							});
						},
						editEntity: 'callflows.vmbox.edit'
					};

					if(hasCategory) {
						action.category = self.i18n.active().oldCallflows.basic_cat;
					}

					return action;
				};

			$.extend(callflow_nodes, {
				// some old nodes won't have an action set, so we need a node to support no "action"
				// this is also the node we want to use when we drag it onto a callflow as we want the back-end to use the default action set in the schemas
				'voicemail[id=*]': getVoicemailNode(true),

				// the default action being "compose", the front-end needs a node handling the "compose" action. 
				// but we set the flag to false so we don't have 2 times the same node in the right list of actions
				'voicemail[id=*,action=compose]': getVoicemailNode(false),

				'voicemail[action=check]': {
					name: self.i18n.active().callflows.vmbox.check_voicemail,
					icon: 'voicemail',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'voicemail',
					tip: self.i18n.active().callflows.vmbox.check_voicemail_tip,
					data: {
						action: 'check'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 120,
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

		vmboxList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxGet: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.get',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.update',
				data: {
					accountId: self.accountId,
					voicemailId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxDelete: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.delete',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxMediaList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxUserList: function(callback) {
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
		}

	};

	return app;
});
