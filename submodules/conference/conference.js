define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.conference.popupEdit': 'conferencePopupEdit',
			'callflows.fetchActions': 'conferenceDefineActions',
			'callflows.conference.edit': '_conferenceEdit'
		},

		conferenceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'conference[id=*]': {
					name: self.i18n.active().callflows.conference.conference,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'conference',
					tip: self.i18n.active().callflows.conference.conference_tip,
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
					weight: 30,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if(id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						self.conferenceList(function(data, status) {
							var popup_html = $(monster.template(self, 'conference-callflowEdit', {
									items: monster.util.sort(data),
									selected: node.getMetadata('id') || ''
								})),
								popup;

							if($('#conference_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') == 'edit') ? { id: $('#conference_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.conferencePopupEdit(_data, function(_data) {
									node.setMetadata('id', _data.id || 'null');

									node.caption = _data.name || '';

									popup.dialog('close');
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#conference_selector', popup_html).val());

								node.caption = $('#conference_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.conference.conference,
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
							resource: 'conference.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.conference.edit'
				},

				'conference[]': {
					name: self.i18n.active().callflows.conference.conference_service,
					icon: 'conference',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'conference',
					tip: self.i18n.active().callflows.conference.conference_service_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 110,
					caption: function(node) {
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

		conferencePopupEdit: function(data, callback, data_defaults) {
			var self = this,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				popup;

			self.conferenceEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.conference.edit_conference : self.i18n.active().callflows.conference.create_conference
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring conferenceEdit
		_conferenceEdit: function(args) {
			var self = this;
			self.conferenceEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		conferenceEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#conference-content'),
				target = _target || $('#conference-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success || function(_data) {
						self.conferenceRenderList(parent);

						self.conferenceEdit({ id: _data.id }, parent, target, callbacks);
					},

					save_error: _callbacks.save_error,

					delete_success: _callbacks.delete_success || function() {
						target.empty(),

						self.conferenceRenderList(parent);
					},

					delete_error: _callbacks.delete_error,

					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						member: {},
						play_entry_tone: true,
						play_exit_tone: true
					}, data_defaults || {}),
					field_data: {
						users: []
					}
				};

			monster.parallel({
					user_list: function(callback) {
						self.callApi({
							resource: 'user.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(_data, status) {
								_data.data.unshift({
									id: '',
									first_name: '- No',
									last_name: 'owner -'
								});

								defaults.field_data.users = _data.data;

								callback(null, _data);
							}
						});
					},
					get_conference: function(callback) {
						if(typeof data == 'object' && data.id) {
							self.conferenceGet(data.id, function(_data, status) {
								self.conferenceMigrateData(_data);

								self.conferenceFormatData(_data);

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
						render_data = $.extend(true, defaults, { data: results.get_conference });
					}

					self.conferenceRender(render_data, target, callbacks);

					if(typeof callbacks.after_render == 'function') {
						callbacks.after_render();
					}
				}
			);
		},

		conferenceRender: function(data, target, callbacks){
			var self = this,
				conference_html = $(monster.template(self, 'conference-edit', data)),
				conference_form = conference_html.find('#conference_form');

			monster.ui.validate(conference_form, {
				rules: {
					name: {
						required: true,
					},
					'member.pins_string': {
						regex: /^[a-z0-9A-Z,\s]*$/
					},
					'conference_numbers_string': {
						regex: /^[0-9,\s]*$/
					}
				},
				messages: {
					'member.pins_string': { regex: self.i18n.active().callflows.conference.validation.member_pins_string },
					'conference_numbers_string': { regex: self.i18n.active().callflows.conference.validation.member_numbers_string }
				}
			});

			$('*[rel=popover]:not([type="text"])', conference_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', conference_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(conference_html);

			if(!$('#owner_id', conference_html).val()) {
				$('#edit_link', conference_html).hide();
			}

			$('#owner_id', conference_html).change(function() {
				!$('#owner_id option:selected', conference_html).val() ? $('#edit_link', conference_html).hide() : $('#edit_link', conference_html).show();
			});

			$('.inline_action', conference_html).click(function(ev) {
				var _data = ($(this).data('action') == 'edit') ? { id: $('#owner_id', conference_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callback: function(_data) {
						/* Create */
						if(!_id) {
							$('#owner_id', conference_html).append('<option id="'+ _data.id  +'" value="'+ _data.id +'">'+ _data.first_name + ' ' + _data.last_name  +'</option>');
							$('#owner_id', conference_html).val(_data.id);
							$('#edit_link', conference_html).show();
						}
						else {
							/* Update */
							if('id' in _data) {
								$('#owner_id #'+_data.id, conference_html).text(_data.first_name + ' ' + _data.last_name);
							}
							/* Delete */
							else {
								$('#owner_id #'+_id, conference_html).remove();
								$('#edit_link', conference_html).hide();
							}
						}
					}
				});
			});

			$('.conference-save', conference_html).click(function(ev) {
				ev.preventDefault();
				var $this = $(this);

				if(!$this.hasClass('disabled')) {
					$this.addClass('disabled');
					if (monster.ui.valid(conference_form)) {
						var form_data = monster.ui.getFormData('conference_form');

						self.conferenceCleanFormData(form_data);

						data.data.member.pins = form_data.member.pins;

						if('field_data' in data) {
							delete data.field_data;
						}

						self.conferenceSave(form_data, data, callbacks.save_success, function(data) {
							$this.removeClass('disabled');
							callbacks && callbacks.hasOwnProperty('save_error') && callbacks.save_error(data);
						});
					}
					else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.conference.there_were_errors_on_the_form);
					};
				}
			});

			$('.conference-delete', conference_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.conference.are_you_sure_you_want_to_delete, function() {
					self.conferenceDelete(data.data.id, callbacks.delete_success, callbacks.delete_error);
				});
			});

			(target)
				.empty()
				.append(conference_html);
		},

		conferenceRenderList: function(parent) {
			var self = this;

			self.conferenceList(function(data, status) {
				var map_crossbar_data = function(data) {
						var new_list = [];

						if(data.length > 0) {
							$.each(data, function(key, val) {
								new_list.push({
									id: val.id,
									title: val.name || self.i18n.active().callflows.conference.name
								});
							});
						}

						new_list.sort(function(a, b) {
							return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
						});

						return new_list;
					};

			// $('#conference-listpanel', parent)
			// 	.empty()
			// 	.listpanel({
			// 		label: self.i18n.active().callflows.conference.conferences_label,
			// 		identifier: 'conference-listview',
			// 		new_entity_label: self.i18n.active().callflows.conference.add_conference_label,
			// 		data: map_crossbar_data(data),
			// 		publisher: monster.pub,
			// 		notifyMethod: 'callflows.conference.edit',
			// 		notifyCreateMethod: 'callflows.conference.edit',
			// 		notifyParent: parent
			// 	});
			});
		},

		conferenceMigrateData: function(data) {
			if(data.member_play_name) {
				if(data.play_name_on_join == undefined) {
					data.play_name_on_join = data.member_play_name;
				}

				delete data.member_play_name;
			}

			if(data.member_join_muted) {
				if(data.member.join_muted == undefined) {
					data.member.join_muted = data.member_join_muted;
				}

				delete data.member_join_muted;
			}

			if(data.member_join_deaf) {
				if(data.member.join_deaf == undefined) {
					data.member.join_deaf = data.member_join_deaf;
				}

				delete data.member_join_deaf;
			}

			return data;
		},

		conferenceFormatData: function(data) {
			if(typeof data.member == 'object') {
				if($.isArray(data.member.pins)) {
					data.member.pins_string = data.member.pins.join(', ');
				}

				if($.isArray(data.conference_numbers)) {
					data.conference_numbers_string = data.conference_numbers.join(', ');
				}
			}

			return data;
		},

		conferenceCleanFormData: function(form_data){
			var self = this;
			form_data.member.pins_string = self.conferenceLettersToNumbers(form_data.member.pins_string);

			form_data.member.pins = $.map(form_data.member.pins_string.split(','), function(val) {
				var pin = $.trim(val);

				if(pin != '') {
					return pin;
				}
				else {
					return null;
				}
			});

			form_data.conference_numbers = $.map(form_data.conference_numbers_string.split(','), function(val) {
				var number = $.trim(val);

				if(number != '') {
					return number;
				}
				else {
					return null;
				}
			});

			return form_data;
		},

		conferenceLettersToNumbers: function(string) {
			var result = '';

			$.each(string.split(''), function(index, value) {
				if(value.match(/^[aAbBcC]$/)) {
					result += '2';
				}
				else if(value.match(/^[dDeEfF]$/)) {
					result += '3';
				}
				else if(value.match(/^[gGhHiI]$/)) {
					result += '4';
				}
				else if(value.match(/^[jJkKlL]$/)) {
					result += '5';
				}
				else if(value.match(/^[mMnNoO]$/)) {
					result += '6';
				}
				else if(value.match(/^[pPqQrRsS]$/)) {
					result += '7';
				}
				else if(value.match(/^[tTuUvV]$/)) {
					result += '8';
				}
				else if(value.match(/^[wWxXyYzZ]$/)) {
					result += '9';
				}
				else {
					result += value;
				}
			});

			return result;
		},

		conferenceSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.conferenceFixArrays(self.conferenceNormalizeData($.extend(true, {}, data.data, form_data)), form_data);

			if(typeof data.data == 'object' && data.data.id) {
				self.conferenceUpdate(normalized_data, function(_data, status) {
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
				self.conferenceCreate(normalized_data, function(_data, status) {
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

		/* Since the extend function doesn't override arrays, we need to do that */
		conferenceFixArrays: function(merged_data, form_data) {
			var self = this;

			if('conference_numbers' in form_data) {
				merged_data.conference_numbers = form_data.conference_numbers;
			}

			return merged_data;
		},

		conferenceNormalizeData: function(data) {
			if(!data.member.pins.length) {
				delete data.member.pins;
			}

			if(data.hasOwnProperty('member') && data.member.hasOwnProperty('numbers') && !data.member.numbers.length) {
				delete data.member.numbers;
			}

			if(!data.owner_id) {
				delete data.owner_id;
			}

			delete data.member.pins_string;
			delete data.conference_numbers_string;

			return data;
		},


		conferenceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'conference.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		conferenceGet: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.get',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		conferenceCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		conferenceUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.update',
				data: {
					accountId: self.accountId,
					conferenceId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		conferenceDelete: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.delete',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
