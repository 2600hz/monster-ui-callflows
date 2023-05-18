define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'timeofdayDefineActions',
			'callflows.timeofday.edit': '_timeofdayEdit'
		},

		timeofdaySave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.timeofdayNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.temporalRuleUpdate(normalized_data, function(_data, status) {
					success && success(_data, status, 'update');
				});
			} else {
				self.temporalRuleCreate(normalized_data, function(_data, status) {
					success & success(_data, status, 'create');
				});
			}
		},

		timeofdayPopupEdit: function(args) {
			var self = this,
				popup,
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html = $('<div class="inline_popup callflows-port"><div class="main_content inline_content"/></div>');

			self.timeofdayEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.timeofday.edit_time_of_day : self.i18n.active().callflows.timeofday.create_time_of_day
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring timeofdayEdit
		_timeofdayEdit: function(args) {
			var self = this;
			self.timeofdayEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		timeofdayEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#timeofday-content'),
				target = _target || $('#timeofday-view', parent),
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
						time_window_start: 32400,
						time_window_stop: 61200,
						wdays: [],
						days: [],
						interval: 1,
						showSave: true
					}, data_defaults || {}),
					field_data: {
						wdays: {
							sunday: {
								friendlyName: self.i18n.active().callflows.timeofday.sunday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.sunday.shortName
							},
							monday: {
								friendlyName: self.i18n.active().callflows.timeofday.monday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.monday.shortName
							},
							tuesday: {
								friendlyName: self.i18n.active().callflows.timeofday.tuesday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.tuesday.shortName
							},
							wednesday: {
								friendlyName: self.i18n.active().callflows.timeofday.wednesday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.wednesday.shortName
							},
							thursday: {
								friendlyName: self.i18n.active().callflows.timeofday.thursday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.thursday.shortName
							},
							friday: {
								friendlyName: self.i18n.active().callflows.timeofday.friday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.friday.shortName
							},
							saturday: {
								friendlyName: self.i18n.active().callflows.timeofday.saturday.friendlyName,
								shortName: self.i18n.active().callflows.timeofday.saturday.shortName
							}
						},

						day: [
							'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
							'17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'
						],

						cycle: [
							{ id: 'daily', value: 'Daily' },
							{ id: 'weekly', value: 'Weekly' },
							{ id: 'monthly', value: 'Monthly' },
							{ id: 'yearly', value: 'Yearly' },
							{ id: 'date', value: 'Date' }
						],

						ordinals: [
							{ id: 'first', value: 'First' },
							{ id: 'second', value: 'Second' },
							{ id: 'third', value: 'Third' },
							{ id: 'fourth', value: 'Fourth' },
							{ id: 'fifth', value: 'Fifth' },
							{ id: 'last', value: 'Last' },
							{ id: 'every', value: 'Day' }
						],

						months: [
							{ id: 1, value: 'January' },
							{ id: 2, value: 'February' },
							{ id: 3, value: 'March' },
							{ id: 4, value: 'April' },
							{ id: 5, value: 'May' },
							{ id: 6, value: 'June' },
							{ id: 7, value: 'July' },
							{ id: 8, value: 'August' },
							{ id: 9, value: 'September' },
							{ id: 10, value: 'October' },
							{ id: 11, value: 'November' },
							{ id: 12, value: 'December' }
						],

						isAllDay: false,

						hideCycle: false
					}
				};

			if (_.isPlainObject(data) && data.id) {
				self.temporalRuleGet(data.id, function(_data) {
					var oldFormatData = { data: _data },
						isAllDay = _.get(_data, 'time_window_start', 0) === 0 && _.get(_data, 'time_window_stop', 86400) === 86400;

					self.timeofdayMigrateData(oldFormatData);
					self.timeofdayFormatData(oldFormatData);

					var renderData = $.extend(true, defaults, oldFormatData);

					renderData.field_data.isAllDay = isAllDay;
					renderData.extra.holidayType = renderData.data.showSave || _data.type !== 'main_holidays'
						? null
						: _.has(_data, 'ordinal')
							? 'advanced'
							: _.has(_data, 'viewData') || _.chain(_data).get('days', []).size().value() > 1
								? 'range'
								: 'single';
					renderData.field_data.hideCycle = !_.isNull(renderData.extra.holidayType) && !_.isNil(renderData.data.end_date);

					self.timeofdayRender(renderData, target, callbacks);

					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}
				});
			} else {
				self.timeofdayRender(defaults, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}
			}
		},

		timeofdayRender: function(data, target, callbacks) {
			var self = this,
				timeofday_html = $(self.getTemplate({
					name: 'callflowEdit',
					data: data,
					submodule: 'timeofday'
				})),
				selectedWdays = data.data.wdays.length,
				_after_render,
				timeofdayForm = timeofday_html.find('#timeofday-form');

			monster.ui.validate(timeofdayForm, {
				rules: {
					'extra.timeofday.from': {},
					'extra.timeofday.to': {
						greaterDate: timeofday_html.find('input[name="extra.timeofday.from"]')
					}
				},
				groups: {
					'extra.timeofday': 'extra.timeofday.from extra.timeofday.to'
				},
				errorPlacement: function(error, element) {
					error.appendTo(element.parent());
				}
			});

			$('*[rel=popover]', timeofday_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(timeofday_html);

			monster.ui.datepicker(timeofday_html.find('#start_date'));
			monster.ui.datepicker(timeofday_html.find('#end_date'));
			monster.ui.timepicker(timeofday_html.find('.timepicker'), {
				step: 5
			});

			$('#yearly_every', timeofday_html).hide();
			$('#monthly_every', timeofday_html).hide();
			$('#weekly_every', timeofday_html).hide();
			$('#ordinal', timeofday_html).hide();
			$('#days_checkboxes', timeofday_html).hide();
			$('#weekdays', timeofday_html).hide();
			$('#specific_day', timeofday_html).hide();

			if (data.data.id === undefined) {
				$('#every', timeofday_html).hide();
				$('#on', timeofday_html).hide();
			} else {
				if (data.data.cycle === 'daily' || data.data.cycle === 'date') {
					$('#every', timeofday_html).hide();
					$('#on', timeofday_html).hide();
				} else if (data.data.cycle === 'monthly') {
					$('#monthly_every', timeofday_html).show();
					$('#ordinal', timeofday_html).show();
					if (data.data.days !== undefined && data.data.days[0] !== undefined) {
						$('#specific_day', timeofday_html).show();
					} else {
						$('#weekdays', timeofday_html).show();
					}
				} else if (data.data.cycle === 'yearly') {
					$('#yearly_every', timeofday_html).show();
					$('#ordinal', timeofday_html).show();
					if (data.data.days !== undefined && data.data.days[0] !== undefined) {
						$('#specific_day', timeofday_html).show();
					} else {
						$('#weekdays', timeofday_html).show();
					}
				} else if (data.data.cycle === 'weekly') {
					$('#weekly_every', timeofday_html).show();
					$('#days_checkboxes', timeofday_html).show();
				}
			}

			$('.fake_checkbox', timeofday_html).click(function() {
				var $this = $(this),
					toCheck = !$this.hasClass('checked');

				$(this).toggleClass('checked');

				if (toCheck) {
					selectedWdays += 1;
				} else {
					selectedWdays -= 1;
				}
			});

			$('#ordinal', timeofday_html).change(function() {
				if ($(this).val() === 'every') {
					$('#weekdays', timeofday_html).hide();
					$('#specific_day', timeofday_html).show();
				} else {
					$('#weekdays', timeofday_html).show();
					$('#specific_day', timeofday_html).hide();
				}
			});

			$('#cycle', timeofday_html).change(function() {
				var $this = $(this);

				$('#yearly_every', timeofday_html).hide();
				$('#monthly_every', timeofday_html).hide();
				$('#weekly_every', timeofday_html).hide();
				$('#ordinal', timeofday_html).hide();
				$('#days_checkboxes', timeofday_html).hide();
				$('#weekdays', timeofday_html).hide();
				$('#specific_day', timeofday_html).hide();
				$('#every', timeofday_html).show();
				$('#on', timeofday_html).show();

				if ($this.val() === 'yearly') {
					$('#yearly_every', timeofday_html).show();
					$('#ordinal', timeofday_html).show();
					if ($('#ordinal', timeofday_html).val() === 'every') {
						//$('#weekdays', timeofday_html).hide();
						$('#specific_day', timeofday_html).show();
					} else {
						$('#weekdays', timeofday_html).show();
						//$('#specific_day', timeofday_html).hide();
					}
				} else if ($this.val() === 'monthly') {
					$('#monthly_every', timeofday_html).show();
					$('#ordinal', timeofday_html).show();
					if ($('#ordinal', timeofday_html).val() === 'every') {
						//$('#weekdays', timeofday_html).hide();
						$('#specific_day', timeofday_html).show();
					} else {
						$('#weekdays', timeofday_html).show();
						//$('#specific_day', timeofday_html).hide();
					}
				} else if ($this.val() === 'weekly') {
					$('#weekly_every', timeofday_html).show();
					$('#days_checkboxes', timeofday_html).show();
				} else if ($this.val() === 'daily' || $this.val() === 'date') {
					$('#every', timeofday_html).hide();
					$('#on', timeofday_html).hide();
				}
			});

			$('.timeofday-save', timeofday_html).click(function(ev) {
				ev.preventDefault();

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					if ($('#cycle', timeofday_html).val() === 'weekly' && selectedWdays === 0) {
						monster.ui.toast({
							type: 'warning',
							message: self.i18n.active().callflows.timeofday.toastr.warning.missingDay
						});
					} else if (monster.ui.valid(timeofdayForm)) {
						var form_data = monster.ui.getFormData('timeofday-form');

						form_data.wdays = [];
						data.data.wdays = [];

						$('.fake_checkbox.checked', timeofday_html).each(function() {
							form_data.wdays.push($(this).data('value'));
						});

						form_data.interval = $('#cycle', timeofday_html).val() === 'monthly' ? $('#interval_month', timeofday_html).val() : $('#interval_week', timeofday_html).val();
						form_data.start_date = timeofday_html.find('#start_date').datepicker('getDate');
						form_data = self.timeofdayCleanFormData(form_data);

						self.timeofdaySave(form_data, data, callbacks.save_success);
					} else {
						$this.removeClass('disabled');
						monster.ui.alert('error', self.i18n.active().callflows.timeofday.there_were_errors_on_the_form);
					}
				}
			});

			$('.timeofday-delete', timeofday_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.timeofday.are_you_sure_you_want_to_delete, function() {
					self.temporalRuleDelete(data.data.id, callbacks.delete_success);
				});
			});

			$('#all_day_checkbox', timeofday_html).on('click', function() {
				var $this = $(this);

				$('input.timepicker', timeofday_html).val('');
				$('.time-wrapper', timeofday_html).toggleClass('hidden', $this.is(':checked'));
			});

			_after_render = callbacks.after_render;

			callbacks.after_render = function() {
				if (typeof _after_render === 'function') {
					_after_render();
				}
			};

			(target)
				.empty()
				.append(timeofday_html);
		},

		timeofdayCleanFormData: function(form_data) {
			var wdays = [],
				timeStart = form_data.extra.allDay ? '0:00' : form_data.extra.timeofday.from,
				timeEnd = form_data.extra.allDay ? '24:00' : form_data.extra.timeofday.to;

			if (form_data.cycle !== 'weekly' && form_data.weekday !== undefined) {
				form_data.wdays = [];
				form_data.wdays.push(form_data.weekday);
			}

			$.each(form_data.wdays, function(i, val) {
				if (val) {
					if (val === 'wednesday') {
						val = 'wensday';
					}
					wdays.push(val);
				}
			});

			if (wdays.length > 0 && wdays[0] === 'sunday') {
				wdays.push(wdays.shift());
			}

			form_data.wdays = wdays;

			if (form_data.start_date === '') {
				delete form_data.start_date;
			} else {
				form_data.start_date = monster.util.dateToBeginningOfGregorianDay(form_data.start_date, monster.util.getCurrentTimeZone());
			}

			form_data.time_window_start = parseInt(monster.util.timeToSeconds(timeStart));
			form_data.time_window_stop = parseInt(monster.util.timeToSeconds(timeEnd));

			if (form_data.month) {
				form_data.month = parseInt(form_data.month);
			}

			delete form_data.extra;

			return form_data;
		},

		timeofdayNormalizeData: function(form_data) {
			if (form_data.cycle === 'weekly') {
				delete form_data.ordinal;
				delete form_data.days;
				delete form_data.month;
			} else if (form_data.cycle === 'daily' || form_data.cycle === 'date') {
				delete form_data.ordinal;
				delete form_data.days;
				delete form_data.month;
				delete form_data.interval;
			} else {
				form_data.cycle === 'yearly' ? delete form_data.interval : delete form_data.month;
				form_data.ordinal !== 'every' ? delete form_data.days : delete form_data.wdays;
			}

			delete form_data.time;
			delete form_data.weekday;

			if (form_data.enabled === 'true') {
				form_data.enabled = true;
			} else if (form_data.enabled === 'false') {
				form_data.enabled = false;
			} else {
				delete form_data.enabled;
			}

			delete form_data.extra;
			delete form_data.showSave;
			delete form_data.showDelete;

			return form_data;
		},

		timeofdayFormatData: function(data) {
			var self = this,
				is12hMode = monster.apps.auth.currentUser.ui_flags && monster.apps.auth.currentUser.ui_flags.twelve_hours_mode ? true : false,
				secondsToTime = function(seconds) {
					var hours = parseInt(seconds / 3600) % 24,
						minutes = (parseInt(seconds / 60) % 60).toString(),
						suffix = '';

					if (is12hMode) {
						suffix = hours >= 12 ? 'PM' : 'AM';
						hours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
					}
					return hours.toString() + ':' + (minutes.length < 2 ? '0' + minutes : minutes) + suffix;
				};

			if (data.data.wdays !== undefined && data.data.cycle !== 'weekly') {
				data.data.weekday = data.data.wdays[0];
			}

			data.extra = {};
			data.extra.timeStart = secondsToTime(data.data.time_window_start);
			data.extra.timeStop = secondsToTime(data.data.time_window_stop);

			data.data.showSave = true;
			data.data.showDelete = data.data.id ? true : false;

			if (data.data.hasOwnProperty('ui_metadata') && data.data.ui_metadata.hasOwnProperty('origin') && data.data.ui_metadata.origin === 'voip') {
				data.data.showSave = false;

				if (!monster.util.isSuperDuper()) {
					data.data.showDelete = false;
				}
			}

			return data;
		},

		timeofdayMigrateData: function(data) {
			// Check for spelling ;)
			if ('wdays' in data.data && $.inArray('wensday', data.data.wdays) > -1) {
				data.data.wdays[data.data.wdays.indexOf('wensday')] = 'wednesday';
			}

			return data;
		},

		timeofdayDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'temporal_route[]': {
					name: self.i18n.active().callflows.timeofday.time_of_day,
					icon: 'temporal_route',
					category: self.i18n.active().callflows.timeofday.time_of_day_cat,
					module: 'temporal_route',
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '9999'
						}
					],
					isUsable: 'true',
					weight: 10,
					key_caption: function(child_node, caption_map) {
						var key = child_node.key,
							caption;

						if (key === '_') {
							caption = self.i18n.active().callflows.timeofday.all_other_times;
						} else if (caption_map.hasOwnProperty(key)) {
							caption = caption_map[key].name;
						} else {
							caption = '';
						}

						return caption;
					},
					key_edit: function(child_node, callback) {
						var _this = this;

						self.temporalRuleAndSetList(function(formattedData) {
							formattedData.rules.push({ id: '_', name: self.i18n.active().callflows.timeofday.all_other_times });

							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'callflowKey',
								data: {
									items: formattedData,
									selected: child_node.key
								},
								submodule: 'timeofday'
							}));

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') === 'edit') ? { id: $('#timeofday_selector', popup_html).val() } : {},
									isRule = $('#timeofday_selector option:selected').parents('optgroup').data('type') === 'rules',
									methodToCall = $(this).data('action') === 'edit' ? (isRule ? 'timeofdayPopupEdit' : 'temporalsetPopupEdit') : 'timeofdayPopupEdit';

								ev.preventDefault();

								self[methodToCall]({
									data: _data,
									callback: function(timeofday) {
										child_node.key = timeofday.id || 'null';

										child_node.key_caption = timeofday.name || '';

										popup.dialog('close');
									}
								});
							});

							if ($('#timeofday_selector option:selected', popup_html).val() === '_') {
								$('#edit_link', popup_html).hide();
							}

							$('#timeofday_selector', popup_html).change(function() {
								$('#timeofday_selector option:selected', popup_html).val() === '_' ? $('#edit_link', popup_html).hide() : $('#edit_link', popup_html).show();
							});

							$('#add', popup_html).click(function() {
								child_node.key = $('#timeofday_selector', popup_html).val();

								child_node.key_caption = $('#timeofday_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.timeofday.time_of_day,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					},
					caption: function(node) {
						return node.getMetadata('timezone') || self.i18n.active().defaultTimezone;
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'callflowTimezone',
							data: {
								items: {},
								selected: {}
							},
							submodule: 'timeofday'
						}));

						timezone.populateDropdown($('#timezone_selector', popup_html), node.getMetadata('timezone') || 'inherit', { inherit: self.i18n.active().defaultTimezone });

						$('#add', popup_html).click(function() {
							var timezone = $('#timezone_selector', popup_html).val();
							if (timezone && timezone !== 'inherit') {
								node.setMetadata('timezone', timezone);
							}

							node.caption = $('#timezone_selector option:selected', popup_html).text();

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.timeofday.select_a_timezone_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					},
					listEntities: function(callback) {
						self.temporalRuleList(function(data) {
							callback && callback(data);
						});
					},
					editEntity: 'callflows.timeofday.edit'
				},
				'temporal_route[action=disable]': {
					name: self.i18n.active().callflows.timeofday.disable_time_of_day,
					icon: 'temporal_route',
					category: self.i18n.active().callflows.timeofday.time_of_day_cat,
					module: 'temporal_route',
					data: {
						action: 'disable',
						rules: []
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
						self.temporalRuleList(function(listRules) {
							var popup,
								popup_html,
								rules = node.getMetadata('rules'),
								unselected_rules = [],
								selected_rules = [];

							if (rules) {
								$.each(listRules, function(i, obj) {
									if ($.inArray(obj.id, rules) !== -1) {
										selected_rules.push(obj);
									} else {
										unselected_rules.push(obj);
									}
								});
							} else {
								unselected_rules = listRules;
							}

							popup_html = $(self.getTemplate({
								name: 'two_column',
								data: {
									left: {
										title: self.i18n.active().callflows.timeofday.unselected_time_of_day_rules,
										items: unselected_rules
									},
									right: {
										title: self.i18n.active().callflows.timeofday.selected_time_of_day_rules,
										items: selected_rules
									}
								},
								submodule: 'timeofday'
							}));

							$('#add', popup_html).click(function() {
								var _rules = [];

								$('.right .connect li', popup_html).each(function() {
									_rules.push($(this).data('id'));
								});

								node.setMetadata('rules', _rules);

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.timeofday.disable_time_of_day_rules_title,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});

							/* Initialize the scrollpane AFTER it has rendered */

							//$('.scrollable', popup).jScrollPane();

							$('.connect', popup).sortable({
								connectWith: $('.connect', popup),
								zIndex: 2000,
								helper: 'clone',
								appendTo: $('.wrapper', popup),
								scroll: false,
								tolerance: 'pointer',
								receive: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								},
								remove: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								}
							});
						});
					}
				},
				'temporal_route[action=enable]': {
					name: self.i18n.active().callflows.timeofday.enable_time_of_day,
					icon: 'temporal_route',
					category: self.i18n.active().callflows.timeofday.time_of_day_cat,
					module: 'temporal_route',
					data: {
						action: 'enable',
						rules: []
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
						self.temporalRuleList(function(listRules) {
							var popup,
								popup_html,
								rules = node.getMetadata('rules'),
								unselected_rules = [],
								selected_rules = [];

							if (rules) {
								$.each(listRules, function(i, obj) {
									if ($.inArray(obj.id, rules) !== -1) {
										selected_rules.push(obj);
									} else {
										unselected_rules.push(obj);
									}
								});
							} else {
								unselected_rules = listRules;
							}

							popup_html = $(self.getTemplate({
								name: 'two_column',
								data: {
									left: {
										title: self.i18n.active().callflows.timeofday.unselected_time_of_day_rules,
										items: unselected_rules
									},
									right: {
										title: self.i18n.active().callflows.timeofday.selected_time_of_day_rules,
										items: selected_rules
									}
								},
								submodule: 'timeofday'
							}));

							$('#add', popup_html).click(function() {
								var _rules = [];

								$('.right .connect li', popup_html).each(function() {
									_rules.push($(this).data('id'));
								});

								node.setMetadata('rules', _rules);

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.timeofday.enable_time_of_day_rules,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});

							/* Initialize the scrollpane AFTER it has rendered */

							//$('.scrollable', popup).jScrollPane();

							$('.connect', popup).sortable({
								connectWith: $('.connect', popup),
								zIndex: 2000,
								helper: 'clone',
								appendTo: $('.wrapper', popup),
								scroll: false,
								tolerance: 'pointer',
								receive: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								},
								remove: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								}
							});
						});
					}
				},
				'temporal_route[action=reset]': {
					name: self.i18n.active().callflows.timeofday.reset_time_of_day,
					icon: 'temporal_route',
					category: self.i18n.active().callflows.timeofday.time_of_day_cat,
					module: 'temporal_route',
					data: {
						action: 'reset',
						rules: []
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
						return '';
					},
					edit: function(node, callback) {
						self.temporalRuleList(function(listRules) {
							var popup,
								popup_html,
								rules = node.getMetadata('rules'),
								unselected_rules = [],
								selected_rules = [];

							if (rules) {
								$.each(listRules, function(i, obj) {
									if ($.inArray(obj.id, rules) !== -1) {
										selected_rules.push(obj);
									} else {
										unselected_rules.push(obj);
									}
								});
							} else {
								unselected_rules = listRules;
							}

							popup_html = $(self.getTemplate({
								name: 'two_column',
								data: {
									left: {
										title: self.i18n.active().callflows.timeofday.unselected_time_of_day_rules,
										items: unselected_rules
									},
									right: {
										title: self.i18n.active().callflows.timeofday.selected_time_of_day_rules,
										items: selected_rules
									}
								},
								submodule: 'timeofday'
							}));

							$('#add', popup_html).click(function() {
								var _rules = [];

								$('.right .connect li', popup_html).each(function() {
									_rules.push($(this).data('id'));
								});

								node.setMetadata('rules', _rules);

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.timeofday.reset_time_of_day_rules,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});

							/* Initialize the scrollpane AFTER it has rendered */

							//$('.scrollable', popup).jScrollPane();

							$('.connect', popup).sortable({
								connectWith: $('.connect', popup),
								zIndex: 2000,
								helper: 'clone',
								appendTo: $('.wrapper', popup),
								scroll: false,
								tolerance: 'pointer',
								receive: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								},
								remove: function() {
									//$('.scrollable', popup).data('jsp').reinitialise();
								}
							});
						});
					}
				}
			});
		},

		temporalRuleAndSetList: function(callback) {
			var self = this;

			monster.parallel({
				'rules': function(callback) {
					self.temporalRuleList(function(data) {
						callback(null, _.sortBy(data, 'name'));
					});
				},
				'sets': function(callback) {
					self.temporalSetList(function(data) {
						callback(null, _.sortBy(data, 'name'));
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		temporalRuleList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.list',
				data: {
					accountId: self.accountId,
					filters: { paginate: false }
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
					filters: { paginate: false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalRuleGet: function(temporalRuleId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.get',
				data: {
					accountId: self.accountId,
					ruleId: temporalRuleId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalRuleCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalRuleUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.update',
				data: {
					accountId: self.accountId,
					ruleId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		temporalRuleDelete: function(temporalRuleId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.delete',
				data: {
					accountId: self.accountId,
					ruleId: temporalRuleId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
