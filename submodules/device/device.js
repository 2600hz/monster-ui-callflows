define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'deviceDefineActions'
		},

		

		devicePopupEdit: function(data, callback, data_defaults) {
			var self = this,
				popup, popup_html;

			popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			self.deviceEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.device.edit_device : self.i18n.active().callflows.device.create_device
					});
				}
			}, data_defaults);
		},

		deviceEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#device-content'),
				target = _target || $('#device-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error || function(_data, status, type) {
						if(status == 200 && type == 'mac_address') {
							monster.ui.alert(self.i18n.active().callflows.device.this_mac_address_is_already_in_use);
						}
					},
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						enabled: true,
						caller_id: {
							external: {},
							internal: {},
							emergency: {}
						},
						ringtones: {},
						call_restriction: { closed_groups: 'inherit' },
						media: {
							secure_rtp: 'none',
							peer_to_peer: 'auto',
							audio: {
								codecs: ['PCMU', 'PCMA']
							},
							video: {
								codecs: []
							},
							fax: {
								option: 'false'
							},
							fax_option: false
						},
						sip: {
							method: 'password',
							invite_format: 'username',
							username: 'user_' + monster.util.randomString(6),
							password: monster.util.randomString(12),
							expire_seconds: '360'
						},
						contact_list: {
							exclude: false
						},
						call_forward: {},
						music_on_hold: {}
					}, data_defaults || {}),

					field_data: {
						users: [],
						call_restriction: {},
						sip: {
							methods: {
								'password': self.i18n.active().callflows.device.password,
								'ip': 'IP'
							},
							invite_formats: {
								'username': 'Username',
								'npan': 'NPA NXX XXXX',
								'e164': 'E. 164'
							}
						},
						media: {
							secure_rtp: {
								value: 'none',
								options: {
									'none': self.i18n.active().callflows.device.none,
									'srtp': self.i18n.active().callflows.device.srtp,
									'zrtp': self.i18n.active().callflows.device.zrtp
								}
							},
							peer_to_peer_options: {
								'auto': self.i18n.active().callflows.device.automatic,
								'true': self.i18n.active().callflows.device.always,
								'false': self.i18n.active().callflows.device.never
							},
							fax: {
								options: {
									'auto': self.i18n.active().callflows.device.auto_detect,
									'true': self.i18n.active().callflows.device.always_force,
									'false': self.i18n.active().callflows.device.disabled
								}
							},
							audio: {
								codecs: {
									'OPUS': 'OPUS',
									'CELT@32000h': 'Siren @ 32Khz',
									'G7221@32000h': 'G722.1 @ 32khz',
									'G7221@16000h': 'G722.1 @ 16khz',
									'G722': 'G722',
									'speex@32000h': 'Speex @ 32khz',
									'speex@16000h': 'Speex @ 16khz',
									'PCMU': 'G711u / PCMU - 64kbps (North America)',
									'PCMA': 'G711a / PCMA - 64kbps (Elsewhere)',
									'G729':'G729 - 8kbps (Requires License)',
									'GSM':'GSM',
									'CELT@48000h': 'Siren (HD) @ 48kHz',
									'CELT@64000h': 'Siren (HD) @ 64kHz'
								}
							},
							video: {
								codecs: {
									'VP8': 'VP8',
									'H264': 'H264',
									'H263': 'H263',
									'H261': 'H261'
								}
							}
						},
						hide_owner: data.hide_owner || false,
						outbound_flags: data.outbound_flags ? data.outbound_flags.join(", ") : data.outbound_flags
					},
					functions: {
						inArray: function(value, array) {
							if(array) {
								return ($.inArray(value, array) == -1) ? false : true;
							}
							else return false;
						}
					}
				};

			monster.parallel({
				list_classifier: function(callback){
					self.callApi({
						resource: 'numbers.listClassifiers',
						data: {
							accountId: self.accountId
						},
						success: function(_data_classifiers) {
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
				account: function(callback){
					self.callApi({
						resource: 'account.get',
						data: {
							accountId: self.accountId
						},
						success: function(_data, status) {
							$.extend(defaults.field_data.sip, {
								realm: _data.data.realm,
							});

							callback(null, _data);
						}
					});
				},
				user_list: function(callback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId
						},
						success: function(_data, status) {
							_data.data.sort(function(a, b) {
								return (a.first_name + a.last_name).toLowerCase() < (b.first_name + b.last_name).toLowerCase() ? -1 : 1;
							});

							_data.data.unshift({
								id: '',
								first_name: '- No',
								last_name: 'owner -',
							});

							defaults.field_data.users = _data.data;

							callback(null, _data);
						}
					});
				},
				media_list: function(callback) {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId
						},
						success: function(_data, status) {
							_data.data.unshift(
								{
									id: '',
									name: self.i18n.active().callflows.device.default_music
								},
								{
									id: 'silence_stream://300000',
									name: self.i18n.active().callflows.device.silence
								}
							);

							defaults.field_data.music_on_hold = _data.data;

							callback(null, _data);
						}
					});
				},
				get_device: function(callback) {
					if(typeof data == 'object' && data.id) {
						self.deviceGet(data.id,	function(_data, status) {
							defaults.data.device_type = 'sip_device';

							if('media' in _data && 'encryption' in _data.media) {
								defaults.field_data.media.secure_rtp.value = _data.media.encryption.enforce_security ? _data.media.encryption.methods[0] : 'none';
							}

							if('sip' in _data && 'realm' in _data.sip) {
								defaults.field_data.sip.realm = _data.sip.realm;
							}

							self.deviceMigrateData(_data);

							callback(null, _data);
						});
					}
					else {
						callback(null, defaults);
					}
				}
			},
			function(err, results){
				var render_data = defaults;

				if(typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, { data: results.get_device });
				}
				console.log(render_data);
				if(results.get_device.hasOwnProperty('media') && results.get_device.media.hasOwnProperty('audio')) {
					// If the codecs property is defined, override the defaults with it. Indeed, when an empty array is set as the
					// list of codecs, it gets overwritten by the extend function otherwise.
					if(results.get_device.media.audio.hasOwnProperty('codecs')) {
						render_data.data.media.audio.codecs = results.get_device.media.audio.codecs;
					}

					if(results.get_device.media.video.hasOwnProperty('codecs')) {
						render_data.data.media.video.codecs = results.get_device.media.video.codecs;
					}
				}

				self.deviceRender(render_data, target, callbacks);

				if(typeof callbacks.after_render == 'function') {
					callbacks.after_render();
				}
			});
		},

		deviceRender: function(data, target, callbacks){
			var self = this,
				device_html,
				render;

				console.log(data);

			if('media' in data.data && 'fax_option' in data.data.media) {
				data.data.media.fax_option = (data.data.media.fax_option === 'auto' || data.data.media.fax_option === true);
			}

			if(typeof data.data == 'object' && data.data.device_type) {
				device_html = $(monster.template(self, 'device-' + data.data.device_type, data));

				/* Do device type specific things here */
				if($.inArray(data.data.device_type, ['fax', 'softphone', 'sip_device', 'smartphone', 'mobile']) > -1) {
					device_html.delegate('#sip_password[type="password"]', 'focus', function() {
						var value = $(this).val();
						$('<input id="sip_password" name="sip.password" type="text"/>').insertBefore($(this)).val(value).focus();
						$(this).remove();
					});

					device_html.delegate('#sip_password[type="text"]', 'blur', function(ev) {
						var value;
						if($(this).attr('removing') != 'true') {
							$(this).attr('removing', 'true');
							value = $(this).val();
							$('<input id="sip_password" name="sip.password" type="password"/>').insertBefore($(this)).val(value);
							$(this).remove();
						}
					});
				}

				//winkstart.validate.set(self.config.validation[data.data.device_type], device_html);

				if(!$('#owner_id', device_html).val()) {
					$('#edit_link', device_html).hide();
				}

				$('#owner_id', device_html).change(function() {
					!$('#owner_id option:selected', device_html).val() ? $('#edit_link', device_html).hide() : $('#edit_link', device_html).show();
				});

				$('.inline_action', device_html).click(function(ev) {
					var _data = ($(this).dataset('action') == 'edit') ? { id: $('#owner_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					winkstart.publish('user.popup_edit', _data, function(_data) {
						/* Create */
						if(!_id) {
							$('#owner_id', device_html).append('<option id="'+ _data.data.id  +'" value="' + _data.data.id +'">'+ _data.data.first_name + ' ' + _data.data.last_name  +'</option>');
							$('#owner_id', device_html).val(_data.data.id);
							$('#edit_link', device_html).show();
						}
						else {
							/* Update */
							if('id' in _data.data) {
								$('#owner_id #'+_data.data.id, device_html).text(_data.data.first_name + ' ' + _data.data.last_name);
							}
							/* Delete */
							else {
								$('#owner_id #'+_id, device_html).remove();
								$('#edit_link', device_html).hide();
							}
						}
					});
				});

				$('.device-save', device_html).click(function(ev) {
					ev.preventDefault();

					//TODO winkstart.validate.is_valid(self.config.validation[data.data.device_type], device_html, function() {
							var form_data = form2object('device-form');

							self.clean_form_data(form_data);

							if(form_data.provision && form_data.provision.endpoint_brand) {
								form_data.provision.endpoint_model = $('.dropdown_family[data-brand="'+form_data.provision.endpoint_brand+'"]', device_html).val();
								if($('#'+form_data.provision.endpoint_model, device_html).size() > 0) {
									form_data.provision.endpoint_family = $('#'+form_data.provision.endpoint_model, device_html).data('family');
								}
							}

							// if('field_data' in data) {
							//     delete data.field_data;
							// }

							self.save_device(form_data, data, callbacks.save_success, winkstart.error_message.process_error(callbacks.save_error));
						/*},
						function() {
							winkstart.alert(_t('device', 'there_were_errors_on_the_form'));
						}
					);*/
				});

				$('.device-delete', device_html).click(function(ev) {
					ev.preventDefault();

					winkstart.confirm(_t('device', 'are_you_sure_you_want_to_delete'), function() {
						self.delete_device(data, callbacks.delete_success, callbacks.delete_error);
					});
				});

				if(!$('#music_on_hold_media_id', device_html).val()) {
					$('#edit_link_media', device_html).hide();
				}

				if(data.data.sip && data.data.sip.method === 'ip') {
					$('#username_block', device_html).hide();
				}
				else {
					$('#ip_block', device_html).hide();
				}

				$('#sip_method', device_html).change(function() {
					if($('#sip_method option:selected', device_html).val() === 'ip') {
						$('#ip_block', device_html).slideDown();
						$('#username_block', device_html).slideUp();
					}
					else {
						$('#username_block', device_html).slideDown();
						$('#ip_block', device_html).slideUp();
					}
				});

				$('#music_on_hold_media_id', device_html).change(function() {
					!$('#music_on_hold_media_id option:selected', device_html).val() ? $('#edit_link_media', device_html).hide() : $('#edit_link_media', device_html).show();
				});

				$('.inline_action_media', device_html).click(function(ev) {
					var _data = ($(this).dataset('action') == 'edit') ? { id: $('#music_on_hold_media_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					winkstart.publish('media.popup_edit', _data, function(_data) {
						/* Create */
						if(!_id) {
							$('#music_on_hold_media_id', device_html).append('<option id="'+ _data.data.id  +'" value="'+ _data.data.id +'">'+ _data.data.name +'</option>');
							$('#music_on_hold_media_id', device_html).val(_data.data.id);

							$('#edit_link_media', device_html).show();
						}
						else {
							/* Update */
							if('id' in _data.data) {
								$('#music_on_hold_media_id #'+_data.data.id, device_html).text(_data.data.name);
							}
							/* Delete */
							else {
								$('#music_on_hold_media_id #'+_id, device_html).remove();
								$('#edit_link_media', device_html).hide();
							}
						}
					});
				});
			}
			else {
				device_html = $(monster.template(self, 'general_edit'));

				$('.media_pane', device_html).hide();
				$('.media_tabs .buttons', device_html).click(function() {
					var $this = $(this);
					$('.media_pane', device_html).show();

					if(!$this.hasClass('current')) {
						$('.media_tabs .buttons').removeClass('current');
						$this.addClass('current');

						data.data.device_type = $this.attr('device_type');

						self.deviceFormatData(data);

						self.deviceRender(data, $('.media_pane', device_html), callbacks);
					}
				});
			}

			$('*[rel=popover]:not([type="text"])', device_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', device_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(device_html);

			/* Awesome sauce for provisioning goodness */
			render = function() {
				(target)
					.empty()
					.append(device_html);
			};

			if(typeof data.data == 'object' && data.data.device_type == 'sip_device') {
				//TODO if(winkstart.publish('phone.render_fields', $(device_html), data.data.provision || (data.data.provision = {}), render, data.list_models || {})) {
					render();
				//}
			}
			else {
				render();

				$('.media_tabs .buttons[device_type="sip_device"]', device_html).trigger('click');
			}
		},

		deviceFormatData: function(data) {
			if(data.data.device_type === 'smartphone' || data.data.device_type === 'landline' || data.data.device_type === 'cellphone') {
				data.data.call_forward = {
					enabled: true,
					require_keypress: true,
					keep_caller_id: true
				};
			}
			else {
				data.data.call_forward = {
					enabled: false
				};
			}

			if(data.data.device_type === 'sip_uri') {
				data.data.sip.invite_format = 'route';
			}

			if(data.data.device_type === 'mobile') {
				if(!('mobile' in data.data)) {
					data.data.mobile = {
						mdn: ''
					};
				}
			}

			if(data.data.device_type === 'fax') {
				data.data.media.fax_option = true;
				data.data.media.fax.option = 'true';
			}
			else {
				data.data.media.fax_option = false;
				data.data.media.fax.option = 'false';
			}
		},

		deviceMigrateData: function(data) {
			var self = this;

			if(data.hasOwnProperty('media') && data.media.hasOwnProperty('audio') && data.media.audio.hasOwnProperty('codecs')) {
				var mapMigrateCodec = {
						'Speex': 'speex@16000h',
						'G722_16': 'G7221@16000h',
						'G722_32': 'G7221@32000h',
						'CELT_48': 'CELT@48000h',
						'CELT_64': 'CELT@64000h'
					},
					newCodecList = [];

				_.each(data.media.audio.codecs, function(codec) {
					mapMigrateCodec.hasOwnProperty(codec) ? newCodecList.push(mapMigrateCodec[codec]) : newCodecList.push(codec);
				});

				data.media.audio.codecs = newCodecList;
			}

			if(data.device_type == 'cell_phone') {
				data.device_type = 'cellphone';
			}

			if(typeof data.media == 'object' && typeof data.media.fax == 'object' && 'codecs' in data.media.fax) {
				delete data.media.fax.codecs;
			}

			if('status' in data) {
				data.enabled = data.status;
				delete data.status;
			}

			if(data.hasOwnProperty('ignore_complete_elsewhere')) {
				data.ignore_completed_elsewhere = data.ignore_complete_elsewhere;

				delete data.ignore_complete_elsewhere;
			}

			return data;
		},

		deviceNormalizeData: function(data) {
			if('provision' in data && data.provision.voicemail_beep !== 0) {
				delete data.provision.voicemail_beep;
			}

			if('media' in data && 'fax' in data.media && 'fax_option' in data.media) {
				data.media.fax.option = data.media.fax_option.toString();
			}

			if('media' in data && 'secure_rtp' in data.media) {
				delete data.media.secure_rtp;
			}

			if('media' in data && 'bypass_media' in data.media) {
				delete data.media.bypass_media;
			}

			if(data.caller_id.internal.number == '' && data.caller_id.internal.name == '') {
				delete data.caller_id.internal;
			}

			if(data.caller_id.external.number == '' && data.caller_id.external.name == '') {
				delete data.caller_id.external;
			}

			if(data.caller_id.emergency.number == '' && data.caller_id.emergency.name == '') {
				delete data.caller_id.emergency;
			}

			if(!data.music_on_hold.media_id) {
				delete data.music_on_hold.media_id;
			}

			if(!data.owner_id) {
				delete data.owner_id;
			}

			if($.isEmptyObject(data.call_forward)) {
				delete data.call_forward;
			}

			if(!data.mac_address) {
				delete data.mac_address;
			}

			if(data.sip.method != 'ip') {
				delete data.sip.ip;
			}

			if(typeof data.outbound_flags == "string") {
				data.outbound_flags = data.outbound_flags.split(/,/);

				/* Get rid of empty string */
				var new_flags = [];
				$.each(data.outbound_flags, function(k, v) {
					if(v.replace(/\s/g, '') !== '') {
						new_flags.push(v);
					}
				});
				data.outbound_flags = new_flags;
			}
			if(data.device_type === 'fax') {
				if(!('outbound_flags' in data)) {
					data.outbound_flags = ['fax'];
				} else if(data.outbound_flags.indexOf('fax') < 0) {
					data.outbound_flags.splice(0,0,'fax');
				}
			}

			if(data.ringtones && 'internal' in data.ringtones && data.ringtones.internal === '') {
				delete data.ringtones.internal;
			}

			if(data.ringtones && 'external' in data.ringtones && data.ringtones.external === '') {
				delete data.ringtones.external;
			}

			if($.inArray(data.device_type, ['fax', 'softphone', 'sip_device', 'smartphone']) < 0) {
				delete data.call_restriction;
			}

			if(data.hasOwnProperty('presence_id') && data.presence_id === '') {
				delete data.presence_id;
			}

			return data;
		},

		deviceCleanFormData: function(form_data) {
			if('provision' in form_data && form_data.provision.voicemail_beep === true) {
				form_data.provision.voicemail_beep = 0;
			}

			if(form_data.mac_address) {
				form_data.mac_address = form_data.mac_address.toLowerCase();

				if(form_data.mac_address.match(/^(((\d|([a-f]|[A-F])){2}-){5}(\d|([a-f]|[A-F])){2})$/)) {
					form_data.mac_address = form_data.mac_address.replace(/-/g,':');
				}
				else if(form_data.mac_address.match(/^(((\d|([a-f]|[A-F])){2}){5}(\d|([a-f]|[A-F])){2})$/)) {
					form_data.mac_address = form_data.mac_address.replace(/(.{2})/g,'$1:').slice(0, -1);
				}
			}

			if(form_data.caller_id) {
				form_data.caller_id.internal.number = form_data.caller_id.internal.number.replace(/\s|\(|\)|\-|\./g,'');
				form_data.caller_id.external.number = form_data.caller_id.external.number.replace(/\s|\(|\)|\-|\./g,'');
				form_data.caller_id.emergency.number = form_data.caller_id.emergency.number.replace(/\s|\(|\)|\-|\./g,'');
			}

			if('media' in form_data && 'audio' in form_data.media) {
				form_data.media.audio.codecs = $.map(form_data.media.audio.codecs, function(val) { return (val) ? val : null });
			}

			if('media' in form_data && 'video' in form_data.media) {
				form_data.media.video.codecs = $.map(form_data.media.video.codecs, function(val) { return (val) ? val : null });
			}

			if(form_data.device_type == 'smartphone' || form_data.device_type == 'landline' || form_data.device_type == 'cellphone') {
				form_data.call_forward.number = form_data.call_forward.number.replace(/\s|\(|\)|\-|\./g,'');
				form_data.enabled = form_data.call_forward.enabled;
			}

			if('extra' in form_data && form_data.extra.notify_unregister === true) {
				form_data.suppress_unregister_notifications = false;
			}
			else {
				form_data.suppress_unregister_notifications = true;
			}

			if('extra' in form_data && 'closed_groups' in form_data.extra) {
				form_data.call_restriction.closed_groups = { action: form_data.extra.closed_groups ? 'deny' : 'inherit' };
			}

			if($.inArray(form_data.device_type, ['sip_device', 'mobile', 'softphone']) > -1) {
				if('extra' in form_data) {
					form_data.media.encryption = form_data.media.encryption || {};

					if($.inArray(form_data.extra.encryptionMethod, ['srtp', 'zrtp']) > -1) {
						form_data.media.encryption.enforce_security = true;
						form_data.media.encryption.methods = [form_data.extra.encryptionMethod];
					}
					else {
						form_data.media.encryption.methods = [];
						form_data.media.encryption.enforce_security = false;
					}
				}
			}

			delete form_data.extra;

			return form_data;
		},

		deviceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceGet: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					deviceId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceDelete: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'device[id=*]': {
					name: self.i18n.active().callflows.device.device,
					icon: 'phone',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'device',
					tip: self.i18n.active().callflows.device.device_tip,
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

						self.deviceList(function(devices) {
							var popup, popup_html;

							popup_html = $(monster.template(self, 'device-callflowEdit', {
								can_call_self: node.getMetadata('can_call_self') || false,
								parameter: {
									name: 'timeout (s)',
									value: node.getMetadata('timeout') || '20'
								},
								objects: {
									items: monster.util.sort(devices),
									selected: node.getMetadata('id') || ''
								}
							}));

							if($('#device_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') === 'edit') ?
												{ id: $('#device_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.devicePopupEdit(_data, function(_data) {
									node.setMetadata('id', _data.data.id || 'null');
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = _data.data.name || '';

									popup.dialog('close');
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#device_selector', popup_html).val());
								node.setMetadata('timeout', $('#parameter_input', popup_html).val());
								node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

								node.caption = $('#device_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.device.device_title,
								beforeClose: function() {
									if(typeof callback == 'function') {
										 callback();
									}
								}
							});
						});
					}
				}
			});
		}
	};

	return app;
});
