define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'miscDefineActions'
		},

		appFlags: {
			misc: {
				webhook: {
					verbsWithFormat: ['post', 'put'],
					bodyFormats: ['form-data', 'json'],
					httpVerbs: {
						get: 'GET',
						post: 'POST',
						put: 'PUT'
					}
				}
			}
		},

		miscGetGroupPickupData: function(callback) {
			var self = this;

			monster.parallel({
				groups: function(callback) {
					self.miscGroupList(function(data) {
						callback(null, data);
					});
				},
				users: function(callback) {
					self.miscUserList(function(data) {
						_.each(data, function(user) {
							user.name = user.first_name + ' ' + user.last_name;
						});
						callback(null, data);
					});
				},
				devices: function(callback) {
					self.miscDeviceList(function(data) {
						callback(null, data);
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		miscDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'root': {
					name: 'Root',
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'false'
				},
				'callflow[id=*]': {
					name: self.i18n.active().oldCallflows.callflow,
					icon: 'callflow',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'callflow',
					tip: self.i18n.active().oldCallflows.callflow_tip,
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
					weight: 20,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							return_value = '';

						if (id in caption_map) {
							if (caption_map[id].hasOwnProperty('name')) {
								return_value = caption_map[id].name;
							} else if (caption_map[id].hasOwnProperty('numbers')) {
								return_value = caption_map[id].numbers.toString();
							}
						}

						return return_value;
					},
					edit: function(node, callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false
								}
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										this.name = this.name ? this.name : ((this.numbers) ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);

										_data.push(this);
									}
								});

								popup_html = $(self.getTemplate({
									name: 'callflow-edit_dialog',
									data: {
										objects: {
											type: 'callflow',
											items: _.sortBy(_data, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'misc'
								}));

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#object-selector', popup_html).val());

									node.caption = $('#object-selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.callflow_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						});
					}
				},
				'do_not_disturb[action=activate]': {
					name: self.i18n.active().callflows.doNotDisturb.activate.label,
					icon: 'x_circle',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.activate.tip,
					data: {
						action: 'activate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 1,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'do_not_disturb[action=deactivate]': {
					name: self.i18n.active().callflows.doNotDisturb.deactivate.label,
					icon: 'x_circle',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.deactivate.tip,
					data: {
						action: 'deactivate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 2,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'do_not_disturb[action=toggle]': {
					name: self.i18n.active().callflows.doNotDisturb.toggle.label,
					icon: 'x_circle',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.toggle.tip,
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
					weight: 3,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=activate]': {
					name: self.i18n.active().oldCallflows.enable_call_forwarding,
					icon: 'rightarrow',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.enable_call_forwarding_tip,
					data: {
						action: 'activate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=deactivate]': {
					name: self.i18n.active().oldCallflows.disable_call_forwarding,
					icon: 'rightarrow',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.disable_call_forwarding_tip,
					data: {
						action: 'deactivate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 20,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=update]': {
					name: self.i18n.active().oldCallflows.update_call_forwarding,
					icon: 'rightarrow',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.update_call_forwarding_tip,
					data: {
						action: 'update'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 30,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'dynamic_cid[]': {
					name: self.i18n.active().oldCallflows.dynamic_cid,
					icon: 'rightarrow',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'dynamic_cid',
					tip: self.i18n.active().oldCallflows.dynamic_cid_tip,
					isUsable: 'true',
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'prepend_cid[action=prepend]': {
					name: self.i18n.active().oldCallflows.prepend,
					icon: 'plus_circle',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'prepend_cid',
					tip: self.i18n.active().oldCallflows.prepend_tip,
					data: {
						action: 'prepend',
						caller_id_name_prefix: '',
						caller_id_number_prefix: '',
						apply_to: 'original'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 20,
					caption: function(node) {
						return (node.getMetadata('caller_id_name_prefix') || '') + ' ' + (node.getMetadata('caller_id_number_prefix') || '');
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'prepend_cid_callflow',
							data: {
								data_cid: {
									'caller_id_name_prefix': node.getMetadata('caller_id_name_prefix') || '',
									'caller_id_number_prefix': node.getMetadata('caller_id_number_prefix') || '',
									'apply_to': node.getMetadata('apply_to') || ''
								}
							},
							submodule: 'misc'
						}));

						$('#add', popup_html).click(function() {
							var cid_name_val = $('#cid_name_prefix', popup_html).val(),
								cid_number_val = $('#cid_number_prefix', popup_html).val(),
								apply_to_val = $('#apply_to', popup_html).val();

							node.setMetadata('caller_id_name_prefix', cid_name_val);
							node.setMetadata('caller_id_number_prefix', cid_number_val);
							node.setMetadata('apply_to', apply_to_val);

							node.caption = cid_name_val + ' ' + cid_number_val;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.prepend_caller_id_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});

						monster.ui.tooltips(popup);

						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'prepend_cid[action=reset]': {
					name: self.i18n.active().oldCallflows.reset_prepend,
					icon: 'loop2',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'prepend_cid',
					tip: self.i18n.active().oldCallflows.reset_prepend_tip,
					data: {
						action: 'reset'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 30,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'set_alert_info[]': {
					name: self.i18n.active().callflows.setAlertInfo.name,
					icon: 'play',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'set_alert_info',
					tip: self.i18n.active().callflows.setAlertInfo.tip,
					data: {
						alert_info: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 20,

					caption: function(node) {
						return (node.getMetadata('alert_info') || '');
					},

					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'setAlertEdit',
								data: {
									alert_info: node.getMetadata('alert_info') || ''
								},
								submodule: 'misc'
							})),
							popup;

						$('#add', popup_html).click(function() {
							var alert_info_val = $('#alert_info', popup_html).val();

							node.setMetadata('alert_info', alert_info_val);

							node.caption = alert_info_val;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.setAlertInfo.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'manual_presence[]': {
					name: self.i18n.active().oldCallflows.manual_presence,
					icon: 'lightbulb_on',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'manual_presence',
					tip: self.i18n.active().oldCallflows.manual_presence_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 40,
					caption: function(node) {
						return node.getMetadata('presence_id') || '';
					},
					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'presence-callflowEdit',
								data: {
									data_presence: {
										'presence_id': node.getMetadata('presence_id') || '',
										'status': node.getMetadata('status') || 'busy'
									}
								},
								submodule: 'misc'
							})),
							popup;

						$('#add', popup_html).click(function() {
							var presence_id = $('#presence_id_input', popup_html).val();
							node.setMetadata('presence_id', presence_id);
							node.setMetadata('status', $('#presence_status option:selected', popup_html).val());

							node.caption = presence_id;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.manual_presence_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'language[]': {
					name: self.i18n.active().oldCallflows.language,
					icon: 'earth',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'language',
					tip: self.i18n.active().oldCallflows.language_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 50,
					caption: function(node) {
						return node.getMetadata('language') || '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'language',
							data: {
								data_language: {
									'language': node.getMetadata('language') || ''
								}
							},
							submodule: 'misc'
						}));

						$('#add', popup_html).click(function() {
							var language = $('#language_id_input', popup_html).val();
							node.setMetadata('language', language);
							node.caption = language;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.language_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'group_pickup[]': {
					name: self.i18n.active().oldCallflows.group_pickup,
					icon: 'sip',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'group_pickup',
					tip: self.i18n.active().oldCallflows.group_pickup_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					weight: 60,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.miscGetGroupPickupData(function(results) {
							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'group_pickup',
								data: {
									data: {
										items: results,
										selected: node.getMetadata('device_id') || node.getMetadata('group_id') || node.getMetadata('user_id') || ''
									}
								},
								submodule: 'misc'
							}));

							$('#add', popup_html).click(function() {
								var selector = $('#endpoint_selector', popup_html),
									id = selector.val(),
									name = selector.find('#' + id).html(),
									type = $('#' + id, popup_html).parents('optgroup').data('type'),
									type_id = type.substring(type, type.length - 1) + '_id';

								/* Clear all the useless attributes */
								node.data.data = {};
								node.setMetadata(type_id, id);
								node.setMetadata('name', name);

								node.caption = name;

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().oldCallflows.select_endpoint_title,
								beforeClose: function() {
									callback && callback();
								}
							});
						});
					}
				},
				'receive_fax[]': {
					name: self.i18n.active().oldCallflows.receive_fax,
					icon: 'sip',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'receive_fax',
					tip: self.i18n.active().oldCallflows.receive_fax_tip,
					data: {
						owner_id: null
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					weight: 70,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.miscUserList(function(data, status) {
							var popup, popup_html;

							$.each(data, function() {
								this.name = this.first_name + ' ' + this.last_name;
							});

							popup_html = $(self.getTemplate({
								name: 'fax-callflowEdit',
								data: {
									objects: {
										items: data,
										selected: node.getMetadata('owner_id') || '',
										t_38: node.getMetadata('media') && (node.getMetadata('media').fax_option || false)
									}
								},
								submodule: 'misc'
							}));

							if ($('#user_selector option:selected', popup_html).val() === undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') === 'edit') ? { id: $('#user_selector', popup_html).val() } : {};

								ev.preventDefault();

								monster.pub('callflows.user.popupEdit', {
									data: _data,
									callback: function(_data) {
										node.setMetadata('owner_id', _data.id || 'null');

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('owner_id', $('#user_selector', popup_html).val());
								node.setMetadata('media', {
									fax_option: $('#t_38_checkbox', popup_html).is(':checked')
								});
								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().oldCallflows.select_user_title,
								minHeight: '0',
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				},
				'record_call[action=start]': {
					name: self.i18n.active().oldCallflows.start_call_recording,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.call_recording_cat,
					module: 'record_call',
					tip: self.i18n.active().oldCallflows.start_call_recording_tip,
					data: {
						action: 'start'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'recordCall-callflowEdit',
								data: {
									data_call_record: {
										'format': node.getMetadata('format') || 'mp3',
										'url': node.getMetadata('url') || '',
										'time_limit': node.getMetadata('time_limit') || '600'
									}
								},
								submodule: 'misc'
							})),
							popup;

						$('#add', popup_html).click(function() {
							var callRecordUrl = $('#url', popup_html).val();
							if (callRecordUrl.trim() !== '') {
								node.setMetadata('url', callRecordUrl);
							} else {
								node.deleteMetadata('url');
							}
							node.setMetadata('format', $('#format', popup_html).val());
							node.setMetadata('time_limit', $('#time_limit', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.start_call_recording,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'record_call[action=stop]': {
					name: self.i18n.active().oldCallflows.stop_call_recording,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.call_recording_cat,
					module: 'record_call',
					tip: self.i18n.active().oldCallflows.stop_call_recording_tip,
					data: {
						action: 'stop'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 20,
					caption: function(node) {
						return '';
					},
					edit: function(node) {
					}
				},
				'pivot[]': {
					name: self.i18n.active().oldCallflows.pivot,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'pivot',
					tip: self.i18n.active().oldCallflows.pivot_tip,
					data: {
						method: 'get',
						req_timeout: '5',
						req_format: 'twiml',
						voice_url: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					weight: 80,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'pivot',
							data: {
								data_pivot: {
									'method': node.getMetadata('method') || 'get',
									'voice_url': node.getMetadata('voice_url') || '',
									'req_timeout': node.getMetadata('req_timeout') || '5',
									'req_format': node.getMetadata('req_format') || 'twiml'
								}
							},
							submodule: 'misc'
						}));

						$('#add', popup_html).click(function() {
							node.setMetadata('voice_url', $('#pivot_voiceurl_input', popup_html).val());
							node.setMetadata('method', $('#pivot_method_input', popup_html).val());
							node.setMetadata('req_format', $('#pivot_format_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.pivot_title,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'disa[]': {
					name: self.i18n.active().oldCallflows.disa,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'disa',
					tip: self.i18n.active().oldCallflows.disa_tip,
					data: {
						pin: '',
						use_account_caller_id: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					weight: 90,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'disa',
							data: {
								data_disa: {
									'pin': node.getMetadata('pin'),
									'retries': node.getMetadata('retries'),
									'interdigit': node.getMetadata('interdigit'),
									'max_digits': node.getMetadata('max_digits'),
									'preconnect_audio': node.getMetadata('preconnect_audio'),
									'use_account_caller_id': node.getMetadata('use_account_caller_id')
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						$('#add', popup_html).click(function() {
							var save_disa = function() {
								var setData = function(field, value) {
									if (value !== 'default') {
										node.setMetadata(field, value);
									} else {
										node.deleteMetadata(field);
									}
								};

								setData('pin', $('#disa_pin_input', popup_html).val());
								setData('retries', $('#disa_retries_input', popup_html).val());
								setData('interdigit', $('#disa_interdigit_input', popup_html).val());
								setData('preconnect_audio', $('#preconnect_audio', popup_html).val());
								setData('use_account_caller_id', !$('#disa_keep_original_caller_id', popup_html).is(':checked'));
								setData('max_digits', $('#disa_max_digits_input', popup_html).val());

								popup.dialog('close');
							};
							if ($('#disa_pin_input', popup_html).val() === '') {
								monster.ui.confirm(self.i18n.active().oldCallflows.not_setting_a_pin, function() {
									save_disa();
								});
							} else {
								save_disa();
							}
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.disa.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'collect_dtmf[]': {
					name: self.i18n.active().callflows.collectDTMF.title,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'collect_dtmf',
					tip: self.i18n.active().callflows.collectDTMF.tip,
					data: {
						pin: '',
						use_account_caller_id: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 90,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'collect-dtmf',
							data: {
								data_dtmf: {
									'interdigit_timeout': node.getMetadata('interdigit_timeout') || '',
									'collection_name': node.getMetadata('collection_name') || '',
									'max_digits': node.getMetadata('max_digits') || '',
									'terminator': node.getMetadata('terminator') || '#',
									'timeout': node.getMetadata('timeout') || '5000'
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default' && value !== '') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							setData('interdigit_timeout', $('#collect_dtmf_interdigit_input', popup_html).val());
							setData('collection_name', $('#collect_dtmf_collection_input', popup_html).val());
							setData('max_digits', $('#collect_dtmf_max_digits_input', popup_html).val());
							setData('terminator', $('#collect_dtmf_terminator_input', popup_html).val());
							setData('timeout', $('#collect_dtmf_timeout_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.collectDTMF.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'sleep[]': {
					name: self.i18n.active().callflows.sleep.name,
					icon: 'dot_chat',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'sleep',
					tip: self.i18n.active().callflows.sleep.tip,
					data: {
						duration: '',
						unit: 's'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 47,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'sleep',
							data: {
								data_sleep: {
									'duration': node.getMetadata('duration')
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							setData('duration', $('#sleep_duration_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.sleep.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'tts[]': {
					name: self.i18n.active().callflows.tts.name,
					icon: 'chat_circle',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'tts',
					tip: self.i18n.active().callflows.tts.tip,
					data: {
						text: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 45,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'tts',
							data: {
								data_tts: {
									'text': node.getMetadata('text'),
									'language': node.getMetadata('language'),
									'voice': node.getMetadata('voice')
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							setData('text', $('#tts_text_input', popup_html).val());
							setData('language', $('#tts_language_input', popup_html).val());
							setData('voice', $('#tts_voice_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.tts.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'response[]': {
					name: self.i18n.active().oldCallflows.response,
					icon: 'rightarrow',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'response',
					tip: self.i18n.active().oldCallflows.response_tip,
					data: {
						code: '',
						message: '',
						media: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					weight: 100,
					caption: function(node) {
						return self.i18n.active().oldCallflows.sip_code_caption + node.getMetadata('code');
					},
					edit: function(node, callback) {
						self.miscMediaList(function(data) {
							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'response',
								data: {
									response_data: {
										items: data,
										media_enabled: node.getMetadata('media') ? true : false,
										selected_media: node.getMetadata('media') || '',
										code: node.getMetadata('code') || '',
										message: node.getMetadata('message') || ''
									}
								},
								submodule: 'misc'
							}));

							if ($('#media_selector option:selected', popup_html).val() === undefined
							|| $('#media_selector option:selected', popup_html).val() === 'null') {
								$('#edit_link', popup_html).hide();
							}

							$('#media_selector', popup_html).change(function() {
								if ($('#media_selector option:selected', popup_html).val() === undefined
								|| $('#media_selector option:selected', popup_html).val() === 'null') {
									$('#edit_link', popup_html).hide();
								} else {
									$('#edit_link', popup_html).show();
								}
							});

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') === 'edit') ? { id: $('#media_selector', popup_html).val() } : {};

								ev.preventDefault();

								monster.pub('callflows.media.editPopup', {
									data: _data,
									callback: function(_data) {
										node.setMetadata('media', _data.data.id || 'null');

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								if ($('#response_code_input', popup_html).val().match(/^[1-6][0-9]{2}$/)) {
									node.setMetadata('code', $('#response_code_input', popup_html).val());
									node.setMetadata('message', $('#response_message_input', popup_html).val());
									if ($('#media_selector', popup_html).val() && $('#media_selector', popup_html).val() !== 'null') {
										node.setMetadata('media', $('#media_selector', popup_html).val());
									} else {
										node.deleteMetadata('media');
									}

									node.caption = self.i18n.active().oldCallflows.sip_code_caption + $('#response_code_input', popup_html).val();

									popup.dialog('close');
								} else {
									monster.ui.alert('error', self.i18n.active().oldCallflows.please_enter_a_valide_sip_code);
								}
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().oldCallflows.response_title,
								minHeight: '0',
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				},
				'missed_call_alert[]': {
					name: self.i18n.active().callflows.missedCallAlert.title,
					icon: 'bell1',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'missed_call_alert',
					tip: self.i18n.active().callflows.missedCallAlert.tip,
					data: {
						name: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 31,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscEditMissedCallAlerts(node, callback);
					}
				},
				'set_variables[]': {
					name: self.i18n.active().callflows.setCav.title,
					icon: 'settings2',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'set_variables',
					tip: self.i18n.active().callflows.setCav.tip,
					data: {
						custom_application_vars: {}
					},
					rules: [],
					isUsable: 'true',
					weight: 31,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.miscEditSetCAV(node, callback);
					}
				},
				'webhook[]': {
					name: self.i18n.active().callflows.webhook.title,
					icon: 'to_cloud',	//graph2
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'webhook',
					tip: self.i18n.active().callflows.webhook.tip,
					data: {},
					rules: [],
					isUsable: 'true',
					weight: 170,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscRenderEditWebhook(node, callback);
					}
				}
			});
		},

		/* Render edit dialogs */
		miscEditMissedCallAlerts: function(node, callback) {
			var self = this,
				recipients = node.getMetadata('recipients'),
				mapUsers = {},
				selectedEmails = [],
				popup;

			_.each(recipients, function(recipient) {
				if (recipient.type === 'user') {
					mapUsers[recipient.id] = recipient;
				} else if (recipient.type === 'email') {
					selectedEmails.push(recipient.id);
				}
			});

			self.miscUserList(function(users) {
				var items = [],
					selectedItems = [];

				_.each(users, function(user) {
					var formattedUser = {
						key: user.id,
						value: user.first_name + ' ' + user.last_name
					};

					items.push(formattedUser);

					if (mapUsers.hasOwnProperty(user.id)) {
						selectedItems.push(formattedUser);
					}
				});

				var template = $(self.getTemplate({
						name: 'missedCallAlert-dialog',
						data: {
							emails: selectedEmails.toString()
						},
						submodule: 'misc'
					})),
					widget = monster.ui.linkedColumns(template.find('.items-selector-wrapper'), items, selectedItems, {
						i18n: {
							columnsTitles: {
								available: self.i18n.active().callflows.missedCallAlert.unselectedUsers,
								selected: self.i18n.active().callflows.missedCallAlert.selectedUsers
							}
						},
						containerClasses: 'skinny'
					});

				template.find('#save_missed_call_alerts').on('click', function() {
					var recipients = [],
						emails = template.find('#emails').val();

					emails = emails.replace(/\s/g, '').split(',');

					_.each(emails, function(email) {
						recipients.push({
							type: 'email',
							id: email
						});
					});

					_.each(widget.getSelectedItems(), function(id) {
						recipients.push({
							type: 'user',
							id: id
						});
					});

					node.setMetadata('recipients', recipients);

					popup.dialog('close');
				});

				popup = monster.ui.dialog(template, {
					title: self.i18n.active().callflows.missedCallAlert.popupTitle,
					beforeClose: function() {
						if (typeof callback === 'function') {
							callback();
						}
					}
				});
			});
		},

		miscEditSetCAV: function(node, callback) {
			var self = this,
				variables = _.extend({}, node.getMetadata('custom_application_vars')),
				initTemplate = function() {
					var template = $(self.getTemplate({
							name: 'setcav-dialog',
							data: {
								variables: variables
							},
							submodule: 'misc'
						})),
						popup;

					if (_.size(variables) <= 0) {
						addRow(template);
					}

					_.each(variables, function(variable, key) {
						addRow(template, {
							key: key,
							value: variable
						});
					});

					popup = monster.ui.dialog(template, {
						title: self.i18n.active().callflows.setCav.popupTitle,
						width: 500,
						beforeClose: function() {
							if (typeof callback === 'function') {
								callback();
							}
						}
					});

					bindSetCavEvents({
						template: template,
						popup: popup
					});
				},
				bindSetCavEvents = function(args) {
					var template = args.template,
						popup = args.popup,
						formData;

					template.find('.cav-add-row .svg-icon')
						.on('click', function() {
							addRow(template);
						});

					template.find('#save_cav_variables').on('click', function() {
						formData = monster.ui.getFormData('set_cav_form');
						variables = _
							.chain(formData.items)
							.reject(function(item) {
								return _.isEmpty(item.key) || _.isEmpty(item.value);
							})
							.keyBy('key')
							.mapValues('value')
							.value();

						node.setMetadata('custom_application_vars', variables);

						popup.dialog('close');
					});
				},
				addRow = function(template, data) {
					var cavRow = $(self.getTemplate({
						name: 'setcav-row',
						submodule: 'misc',
						data: _.merge(data, {
							index: template.find('.cav-list tbody tr').length + 1
						})
					}));

					template.find('.cav-list tbody')
						.append(cavRow);

					template.find('.cav-remove-row')
						.on('click', function() {
							if (template.find('.cav-list tbody tr').length <= 1) {
								return;
							}

							$(this).parent().parent().remove();
						});
				};

			initTemplate();
		},

		miscRenderEditWebhook: function(node, callback) {
			var self = this,
				popup,
				initTemplate = function() {
					var data = {
							hasVerbWithFormat: _.includes(self.appFlags.misc.webhook.verbsWithFormat, node.getMetadata('http_verb')),
							bodyFormatList: _.map(self.appFlags.misc.webhook.bodyFormats, function(item) {
								return {
									value: item,
									label: _.get(self.i18n.active().callflows.webhook.format.options, _.camelCase(item), monster.util.formatVariableToDisplay(item))
								};
							}),
							httpVerbsList: self.appFlags.misc.webhook.httpVerbs,
							format: node.getMetadata('format', ''),
							uri: node.getMetadata('uri', ''),
							http_verb: node.getMetadata('http_verb', 'get'),
							retries: node.getMetadata('retries', 1),
							custom_data: node.getMetadata('custom_data', {})
						},
						$template = $(self.getTemplate({
							name: 'webhook-callflowEdit',
							data: data,
							submodule: 'misc'
						})),
						$form = $template.find('#webhook_form');

					monster.ui.keyValueEditor($template.find('.custom-data-container'), {
						data: data.custom_data,
						inputName: 'custom_data'
					});

					monster.ui.tooltips($template);

					monster.ui.validate($form, {
						rules: {
							uri: {
								required: true,
								url: true
							}
						},
						messages: {
							uri: {
								url: self.i18n.active().callflows.webhook.uri.errorMessages.url
							}
						}
					});

					$template.find('#http_verb').on('change', function() {
						var $this = $(this),
							newValue = $this.val(),
							$formPopupField = $template.find('#form_popup_field'),
							animationMethod = _.includes(self.appFlags.misc.webhook.verbsWithFormat, newValue) ? 'slideDown' : 'slideUp';

						$formPopupField[animationMethod](250);
					});

					$template.find('#add').on('click', function(e) {
						e.preventDefault();

						if (!monster.ui.valid($form)) {
							return;
						}

						var formData = monster.ui.getFormData('webhook_form');

						_.each(formData, function(value, key) {
							if (key === 'custom_data') {
								value = _
									.chain(value)
									.keyBy('key')
									.mapValues('value')
									.value();
							} else if (key === 'retries') {
								value = _.parseInt(value, 10);
							} else if (
								key === 'format'
								&& !_.includes(self.appFlags.misc.webhook.verbsWithFormat, formData.http_verb)
							) {
								node.deleteMetadata('format');
								return;
							}

							node.setMetadata(key, value);
						});

						popup.dialog('close');
					});

					return $template;
				};

			popup = monster.ui.dialog(initTemplate(), {
				title: self.i18n.active().callflows.webhook.popupTitle,
				beforeClose: function() {
					if (_.isFunction(callback)) {
						callback();
					}
				}
			});
		},

		/* API helpers */
		miscDeviceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		miscGroupList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'group.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		miscUserList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		miscMediaList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
