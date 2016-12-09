define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {
			'callflows.device.getProvisionerPhones': {
				'apiRoot': monster.config.api.provisioner,
				'url': 'phones/',
				'verb': 'GET',
				'headers': {
					'Accept': '*/*'
				}
			}
		},

		subscribe: {
			'callflows.fetchActions': 'deviceDefineActions',
			'callflows.device.popupEdit': 'devicePopupEdit',
			'callflows.device.edit': '_deviceEdit'
		},

		devicePopupEdit: function(args) {
			var self = this,
				popup,
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

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

		// Added for the subscribed event to avoid refactoring deviceEdit
		_deviceEdit: function(args) {
			var self = this;
			self.deviceEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
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
				},
				parallelRequests = function (deviceData) {
					monster.parallel({
						list_classifier: function(callback){
							self.callApi({
								resource: 'numbers.listClassifiers',
								data: {
									accountId: self.accountId,
									filters: { paginate:false }
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
									accountId: self.accountId,
									filters: { paginate:false }
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

									if (deviceData.hasOwnProperty('device_type') && deviceData.device_type === 'mobile') {
										var userData = _.find(_data.data, function(user, idx) { return user.id === deviceData.owner_id; });

										if (userData) {
											defaults.field_data.users = userData;
										}
										else {
											defaults.field_data.users = {
												first_name: '- No',
												last_name: 'owner -'
											};
										}
									}
									else {
										defaults.field_data.users = _data.data;
									}

									callback(null, _data);
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
						provisionerData: function(callback) {
							if(monster.config.api.hasOwnProperty('provisioner') && monster.config.api.provisioner) {
								self.deviceGetDataProvisoner(function(data) {
									callback(null, data);
								});
							}
							else {
								callback(null, {});
							}
						}
					},
					function(err, results){
						var render_data = self.devicePrepareDataForTemplate(data, defaults, $.extend(true, results, {
								get_device: deviceData
							}));

						self.deviceRender(render_data, target, callbacks);

						if(typeof callbacks.after_render == 'function') {
							callbacks.after_render();
						}
					});
				};

			if(typeof data == 'object' && data.id) {
				self.deviceGet(data.id, function(_data, status) {
					defaults.data.device_type = 'sip_device';

					if('media' in _data && 'encryption' in _data.media) {
						defaults.field_data.media.secure_rtp.value = _data.media.encryption.enforce_security ? _data.media.encryption.methods[0] : 'none';
					}

					if('sip' in _data && 'realm' in _data.sip) {
						defaults.field_data.sip.realm = _data.sip.realm;
					}

					self.deviceMigrateData(_data);

					parallelRequests(_data);
				});
			}
			else {
				parallelRequests(defaults);
			}
		},

		devicePrepareDataForTemplate: function(data, dataGlobal, results) {
			var self = this,
				dataDevice = results.get_device,
				dataProvisioner = results.provisionerData;

			if(typeof data === 'object' && data.id) {
				dataGlobal = $.extend(true, dataGlobal, { data: dataDevice });
			}

			if(dataDevice.hasOwnProperty('media') && dataDevice.media.hasOwnProperty('audio')) {
				// If the codecs property is defined, override the defaults with it. Indeed, when an empty array is set as the
				// list of codecs, it gets overwritten by the extend function otherwise.
				if(dataDevice.media.audio.hasOwnProperty('codecs')) {
					dataGlobal.data.media.audio.codecs = dataDevice.media.audio.codecs;
				}

				if(dataDevice.media.video.hasOwnProperty('codecs')) {
					dataGlobal.data.media.video.codecs = dataDevice.media.video.codecs;
				}
			}

			_.each(dataGlobal.field_data.call_restriction, function(restriction, key) {
				restriction.value = dataGlobal.data.call_restriction[key].action;
			});

			dataGlobal.field_data.provisioner = dataProvisioner;
			dataGlobal.field_data.provisioner.isEnabled = !_.isEmpty(dataProvisioner);

			if(dataGlobal.field_data.provisioner.isEnabled) {
				var default_provision_data = {
					voicemail_beep: 1, //ie enabled
					time_format: '12',
					hotline: '',
					vlan: {
						enable: false,
						number: ''
					},
					date_format: 'middle-endian'
				}

				dataGlobal.data.provision = $.extend(true, {}, default_provision_data, dataGlobal.data.provision);
			}

			return dataGlobal;
		},

		deviceGetValidationByDeviceType: function(deviceType) {
			var validation = {
				sip_uri: {},
				sip_device : {
					'mac_address': { mac: true },
					'sip_expire_seconds': {	digits: true }
				},
				fax : {
					'mac_address': { mac: true },
					'sip_expire_seconds': {	digits: true }
				},
				cellphone: {},
				smartphone: {
					'sip_expire_seconds': {	digits: true }
				},
				landline: {},
				softphone: {
					'sip_expire_seconds': {	digits: true }
				},
				mobile: {
					'mdn': { digits: true },
					'sip_expire_seconds': {	digits: true }
				}
			};

			return { rules: validation[deviceType] };
		},

		deviceRender: function(data, target, callbacks){
			var self = this,
				device_html,
				render;

			if('media' in data.data && 'fax_option' in data.data.media) {
				data.data.media.fax_option = (data.data.media.fax_option === 'auto' || data.data.media.fax_option === true);
			}

			if(typeof data.data == 'object' && data.data.device_type) {
				device_html = $(monster.template(self, 'device-' + data.data.device_type, data));

				var deviceForm = device_html.find('#device-form');

				if(monster.config.api.hasOwnProperty('provisioner') && monster.config.api.provisioner)  {
					self.deviceSetProvisionerStuff(device_html, data);
				}

				/* Do device type specific things here */
				if($.inArray(data.data.device_type, ['fax', 'softphone', 'sip_device', 'smartphone', 'mobile']) > -1) {
					monster.ui.protectField(device_html.find('#sip_password'), device_html);
				}

				monster.ui.validate(deviceForm, self.deviceGetValidationByDeviceType(data.data.device_type));

				if(!$('#owner_id', device_html).val()) {
					$('#edit_link', device_html).hide();
				}


				monster.ui.mask(device_html.find('#mac_address'), 'macAddress');

				$('#owner_id', device_html).change(function() {
					!$('#owner_id option:selected', device_html).val() ? $('#edit_link', device_html).hide() : $('#edit_link', device_html).show();
				});

				$('.inline_action', device_html).click(function(ev) {
					var _data = ($(this).data('action') == 'edit') ? { id: $('#owner_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					monster.pub('callflows.user.popupEdit', {
						data: _data,
						callback: function(user) {
							/* Create */
							if(!_id) {
								$('#owner_id', device_html).append('<option id="'+ user.id  +'" value="' + user.id +'">'+ user.first_name + ' ' + user.last_name  +'</option>');
								$('#owner_id', device_html).val(user.id);
								$('#edit_link', device_html).show();
							}
							else {
								/* Update */
								if(_data.hasOwnProperty('id')) {
									$('#owner_id #'+user.id, device_html).text(user.first_name + ' ' + user.last_name);
								}
								/* Delete */
								else {
									$('#owner_id #'+_id, device_html).remove();
									$('#edit_link', device_html).hide();
								}
							}
						}
					});
				});

				$('.device-save', device_html).click(function(ev) {
					ev.preventDefault();

					var $this = $(this);

					if(!$this.hasClass('disabled')) {
						$this.addClass('disabled');
						if(monster.ui.valid(deviceForm)) {
							var form_data = monster.ui.getFormData('device-form');

							self.deviceCleanFormData(form_data);

							if(form_data.hasOwnProperty('provision') && form_data.provision.hasOwnProperty('endpoint_brand') && form_data.provision.endpoint_brand !== 'none') {
								// We have to set this manually since we have 3 dropdown with the same name we don't know which selected one is the correct one..
								form_data.provision.endpoint_model = $('.dropdown_family[data-brand="'+form_data.provision.endpoint_brand+'"]', device_html).val();
								form_data.provision.endpoint_family = $('#'+form_data.provision.endpoint_model, device_html).parents('optgroup').data('family');
							}

							self.deviceSave(form_data, data, callbacks.save_success);
						}
						else {
							$this.removeClass('disabled');
							monster.ui.alert('error', self.i18n.active().callflows.device.there_were_errors_on_the_form);
						}
					}
				});

				if (data.device_type !== 'mobile') {
					$('.device-delete', device_html).click(function(ev) {
						ev.preventDefault();

						monster.ui.confirm(self.i18n.active().callflows.device.are_you_sure_you_want_to_delete, function() {
							self.deviceDelete(data.data.id, callbacks.delete_success);
						});
					});
				}

				if(!$('#music_on_hold_media_id', device_html).val()) {
					$('#edit_link_media', device_html).hide();
				}

				if(data.data.sip && data.data.sip.method === 'ip') {
					$('#username_block', device_html).hide();
				}
				else {
					$('#ip_block', device_html).hide();
				}

				device_html.find('#sip_method').on('change', function() {
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
					var _data = ($(this).data('action') == 'edit') ? { id: $('#music_on_hold_media_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					monster.pub('callflows.media.editPopup', {
						data: _data,
						callback: function(media) {
							/* Create */
							if(!_id) {
								$('#music_on_hold_media_id', device_html).append('<option id="'+ media.id  +'" value="'+ media.id +'">'+ media.name +'</option>');
								$('#music_on_hold_media_id', device_html).val(media.id);

								$('#edit_link_media', device_html).show();
							}
							else {
								/* Update */
								if(media.hasOwnProperty('id')) {
									$('#music_on_hold_media_id #'+ media.id, device_html).text(media.name);
								}
								/* Delete */
								else {
									$('#music_on_hold_media_id #'+_id, device_html).remove();
									$('#edit_link_media', device_html).hide();
								}
							}
						}
					});
				});
			}
			else {
				device_html = $(monster.template(self, 'device-general_edit'));

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

			(target)
				.empty()
				.append(device_html);

			$('.media_tabs .buttons[device_type="sip_device"]', device_html).trigger('click');
		},

		deviceSetProvisionerStuff: function(device_html, data) {
			var self = this,
				set_value = function(brand_name, model_name) {
					device_html.find('.dropdown_family').hide();
					if(brand_name in data.field_data.provisioner.brands) {
						device_html.find('#dropdown_brand').val(brand_name);
						device_html.find('.dropdown_family[data-brand="'+brand_name+'"]').show()
																						 .val(model_name);
					}
				},
				provisionData = data.data.provision,
				regex_brands = {
					"00085d": "aastra",
					"0010bc": "aastra",
					"00036b": "cisco",
					"00000c": "cisco",
					"000142": "cisco",
					"000143": "cisco",
					"000163": "cisco",
					"000164": "cisco",
					"000196": "cisco",
					"000197": "cisco",
					"0001c7": "cisco",
					"0001c9": "cisco",
					"000f23": "cisco",
					"0013c4": "cisco",
					"0016c8": "cisco",
					"001818": "cisco",
					"00175a": "cisco",
					"001795": "cisco",
					"001A2f": "cisco",
					"001c58": "cisco",
					"001dA2": "cisco",
					"002155": "cisco",
					"000e84": "cisco",
					"000e38": "cisco",
					"00070e": "cisco",
					"001bd4": "cisco",
					"001930": "cisco",
					"0019aa": "cisco",
					"001d45": "cisco",
					"001ef7": "cisco",
					"000e08": "cisco",
					"1cdf0f": "cisco",
					"e05fb9": "cisco",
					"5475d0": "cisco",
					"c46413": "cisco",
					"000Ffd3": "digium",
					"000b82": "grandstream",
					"08000f": "mitel",
					"1045bE": "norphonic",
					"0050c2": "norphonic",
					"0004f2": "polycom",
					"00907a": "polycom",
					"000413": "snom",
					"001f9f": "thomson",
					"00147f": "thomson",
					"642400": "xorcom",
					"001565": "yealink"
				};

			set_value(provisionData.endpoint_brand, provisionData.endpoint_model);

			device_html.find('#dropdown_brand').on('change', function() {
				set_value($(this).val());
			});

			device_html.find('#mac_address').on('keyup', function() {
				var mac_address = $(this).val().replace(/[^0-9a-fA-F]/g, '');

				if(mac_address in regex_brands) {
					set_value(regex_brands[mac_address]);
				}
			});
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
			if(data.hasOwnProperty('provision')) {
				if(data.provision.endpoint_brand === 'none') {
					delete data.provision;
				}
				else {
					if(data.provision.voicemail_beep !== 0) {
						delete data.provision.voicemail_beep;
					}
				}
			}

			if(data.hasOwnProperty('media') && data.media.hasOwnProperty('fax_option') && data.media.fax_option === 'auto') {
				delete data.media.fax_option;
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

			if($.inArray(data.device_type, ['fax', 'mobile', 'softphone', 'sip_device', 'smartphone']) < 0) {
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

		deviceFixArrays: function(data, data2) {
			if(typeof data.media == 'object' && typeof data2.media == 'object') {
				(data.media.audio || {}).codecs = (data2.media.audio || {}).codecs;
				(data.media.video || {}).codecs = (data2.media.video || {}).codecs;
			}

			if('media' in data2 && 'encryption' in data2.media && 'methods' in data2.media.encryption) {
				data.media.encryption = data.media.encryption || {};
				data.media.encryption.methods = data2.media.encryption.methods;
			}

			return data;
		},

		deviceSave: function(form_data, data, success) {
			var self = this,
				id = (typeof data.data == 'object' && data.data.id) ? data.data.id : undefined,
				normalized_data = self.deviceFixArrays(self.deviceNormalizeData($.extend(true, {}, data.data, form_data)), form_data);

			if(id) {
				self.deviceUpdate(normalized_data, function(_data, status) {
					success && success(_data, status, 'update');
				});
			}
			else {
				self.deviceCreate(normalized_data, function(_data, status) {
					success && success(_data, status, 'create');
				});
			}
		},

		deviceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
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

		deviceGetDataProvisoner: function(callback) {
			var self = this;

			monster.request({
				resource: 'callflows.device.getProvisionerPhones',
				data: {
				},
				success: function(data) {
					data = self.deviceFormatDataProvisioner(data.data);

					callback && callback(data)
				}
			});
		},

		deviceFormatDataProvisioner: function(data) {
			var self = this,
				formattedData = {
					brands: data
				};

			return formattedData;
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
					weight: 10,
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

								self.devicePopupEdit({
									data: _data,
									callback: function(device) {
										node.setMetadata('id', device.id || 'null');
										node.setMetadata('timeout', $('#parameter_input', popup_html).val());
										node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

										node.caption = device.name || '';

										popup.dialog('close');
									}
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
					},
					listEntities: function(callback) {
						self.callApi({
							resource: 'device.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.device.edit'
				}
			});
		}
	};

	return app;
});
