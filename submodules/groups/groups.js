define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'groupsDefineActions'
		},

		groupsDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'ring_group[]': {
					name: self.i18n.active().oldCallflows.ring_group,
					icon: 'ring_group',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'ring_group',
					tip: self.i18n.active().oldCallflows.ring_group_tip,
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
					weight: 20,
					caption: function(node, caption_map) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.groupsEditRingGroup(node, callback);
					}
				},
				'page_group[]': {
					name: self.i18n.active().oldCallflows.page_group,
					icon: 'ring_group',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'page_group',
					tip:  self.i18n.active().oldCallflows.page_group_tip,
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
					weight: 30,
					caption: function(node, caption_map) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.groupsEditPageGroup(node, callback);
					}
				},
			});
		},

		groupsEditPageGroup: function(node, callback) {
			var self = this,
				node = node,
				callback = callback;

			self.groupsDeviceList(function(data) {
				var popup, popup_html, index, endpoints
					selected_endpoints = {},
					unselected_endpoints = [],
					unselected_groups = [],
					unselected_devices = [],
					unselected_users = [];

				if(endpoints = node.getMetadata('endpoints')) {
					// We need to translate the endpoints to prevent nasty O(N^2) time complexities,
					// we also need to clone to prevent managing of objects
					$.each($.extend(true, {}, endpoints), function(i, obj) {
						obj.name = 'Undefined Device';
						selected_endpoints[obj.id] = obj;
					});
				}

				$.each(data, function(i, obj) {
					obj.endpoint_type = 'device';
					if(obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					}
					else {
						unselected_devices.push(obj);
					}
				});

				unselected_devices = monster.util.sort(unselected_devices);

				self.groupsGroupList(function(_data) {
					$.each(_data, function(i, obj) {
						obj.endpoint_type = 'group';
						if(obj.id in selected_endpoints) {
							selected_endpoints[obj.id].endpoint_type = 'group',
							selected_endpoints[obj.id].name = obj.name;
						}
						else {
							unselected_groups.push(obj);
						}
					});

					unselected_groups = monster.util.sort(unselected_groups);

					self.groupsUserList(function(_data) {
						$.each(_data, function(i, obj) {
							obj.name = obj.first_name + ' ' + obj.last_name;
							obj.endpoint_type = 'user';
							if(obj.id in selected_endpoints) {
								selected_endpoints[obj.id].endpoint_type = 'user',
								selected_endpoints[obj.id].name = obj.name;
							}
							else {
								unselected_users.push(obj);
							}
						});
						unselected_users = monster.util.sort(unselected_users);

						popup_html = $(monster.template(self, 'groups-page_group_dialog', {
							form: {
								name: node.getMetadata('name') || ''
							}
						}));
						$.each(unselected_groups, function() {
							$('#groups_pane .connect.left', popup_html).append($(monster.template(self, 'groups-page_group_element', this)));
						});

						$.each(unselected_devices, function() {
							$('#devices_pane .connect.left', popup_html).append($(monster.template(self, 'groups-page_group_element', this)));
						});

						$.each(unselected_users, function() {
							$('#users_pane .connect.left', popup_html).append($(monster.template(self, 'groups-page_group_element', this)));
						});

						$.each(selected_endpoints, function() {
							//Check if user/device exists.
							if(this.endpoint_type) {
								$('.connect.right', popup_html).append($(monster.template(self, 'groups-page_group_element', this)));
							}
						});

						$('#name', popup_html).bind('keyup blur change', function() {
							$('.column.right .title', popup_html).html('Page Group - ' + $(this).val());
						});

						$('ul.settings1 > li > a', popup_html).click(function(item) {
							$('.pane_content', popup_html).hide();

							//Reset Search field
							$('.searchfield', popup_html).val('');
							$('.column.left li', popup_html).show();

							$('ul.settings1 > li', popup_html).removeClass('current');

							var tab_id = $(this).attr('id');

							if(tab_id  === 'users_tab_link') {
								$('#users_pane', popup_html).show();
							}
							else if(tab_id === 'devices_tab_link') {
								$('#devices_pane', popup_html).show();
							}
							else if(tab_id === 'groups_tab_link') {
								$('#groups_pane', popup_html).show();
							}

							$(this).parent().addClass('current');
						});

						$('.searchsubmit2', popup_html).click(function() {
							$('.searchfield', popup_html).val('');
							$('.column li', popup_html).show();
						});

						$('#devices_pane .searchfield', popup_html).keyup(function() {
							$('#devices_pane .column.left li').each(function() {
								if($('.item_name', $(this)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
									$(this).hide();
								}
								else {
									$(this).show();
								}
							});
						});

						$('#users_pane .searchfield', popup_html).keyup(function() {
							$('#users_pane .column.left li').each(function() {
								if($('.item_name', $(this)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
									$(this).hide();
								}
								else {
									$(this).show();
								}
							});
						});

						$('#groups_pane .searchfield', popup_html).keyup(function() {
							$('#groups_pane .column.left li').each(function() {
								if($('.item_name', $(this)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
									$(this).hide();
								}
								else {
									$(this).show();
								}
							});
						});

						if($.isEmptyObject(selected_endpoints)) {
							$('.column.right .connect', popup_html).addClass('no_element');
						}
						else {
							$('.column.right .connect', popup_html).removeClass('no_element');
						}

						$('.column.left .options', popup_html).hide();
						$('.column.left .actions', popup_html).hide();

						$('.options .option.delay', popup_html).bind('keyup', function() {
							$(this).parents('li').data('delay', $(this).val());
						});

						$('.options .option.timeout', popup_html).bind('keyup', function() {
							$(this).parents('li').data('timeout', $(this).val());
						});

						$('#save_ring_group', popup_html).click(function() {
							var name = $('#name', popup_html).val();

							endpoints = [];

							$('.right .connect li', popup_html).each(function() {
								var item_data = this.dataset;
								delete item_data.owner_id;
								endpoints.push(item_data);
							});

							node.setMetadata('endpoints', endpoints);
							node.setMetadata('name', name);

							node.caption = name;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.page_group_title,
							beforeClose: function() {
								if(typeof callback == 'function') {
									callback();
								}
							}
						});

						// $('.scrollable', popup).jScrollPane({
						// 	horizontalDragMinWidth: 0,
						// 	horizontalDragMaxWidth: 0
						// });

						$('.connect', popup).sortable({
							connectWith: $('.connect.right', popup),
							zIndex: 2000,
							helper: 'clone',
							appendTo: $('.wrapper', popup),
							scroll: false,
							receive: function(ev, ui) {
								var data = ui.item[0].dataset,
									list_li = [],
									confirm_text;

								if(data.endpoint_type === 'device') {
									confirm_text = self.i18n.active().oldCallflows.the_owner_of_this_device_is_already;
									$('.connect.right li', popup_html).each(function() {
										if($(this).data('id') === data.owner_id) {
											list_li.push($(this));
										}
									});
								}
								else if(data.endpoint_type === 'user') {
									confirm_text = self.i18n.active().oldCallflows.this_user_has_already_some_devices;
									$('.connect.right li', popup_html).each(function() {
										if($(this).data('owner_id') === data.id) {
											list_li.push($(this));
										}
									});
								}

								if(list_li.length > 0) {
									monster.ui.confirm(confirm_text,
										function() {
											$.each(list_li, function() {
												remove_element(this);
											});
										},
										function() {
											remove_element(ui.item);
										}
									);
								}

								if($(this).hasClass('right')) {
									$('.options', ui.item).show();
									$('.actions', ui.item).show();
									//$('.item_name', ui.item).addClass('right');
									$('.column.right .connect', popup).removeClass('no_element');
								}
							}
						});

						$(popup_html).delegate('.trash', 'click', function() {
							var $parent_li = $(this).parents('li').first();
							remove_element($parent_li);
						});

						$('.pane_content', popup_html).hide();
						$('#users_pane', popup_html).show();

						var remove_element = function(li) {
							var $parent_li = li;
							var data = $parent_li[0].dataset;
							data.name = jQuery.trim($('.item_name', $parent_li).html());
							$('#'+data.endpoint_type+'s_pane .connect.left', popup_html).append($(monster.template(self, 'groups-page_group_element', data)));
							$parent_li.remove();

							if($('.connect.right li', popup_html).size() == 0) {
								$('.column.right .connect', popup).addClass('no_element');
							}

							if(data.name.toLowerCase().indexOf($('#'+data.endpoint_type+'s_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
								$('#'+data.id, popup_html).hide();
							}
						};
					});
				});
			});
		},

		groupsEditRingGroup: function(node, callback) {
			var self = this,
				default_timeout = '20',
				default_delay = '0',
				node = node,
				callback = callback;

			self.groupsDeviceList(function(data) {
				var popup, popup_html, index, endpoints
					selected_endpoints = {},
					unselected_endpoints = [],
					unselected_groups = [],
					unselected_devices = [],
					unselected_users = [];

				if(endpoints = node.getMetadata('endpoints')) {
					// We need to translate the endpoints to prevent nasty O(N^2) time complexities,
					// we also need to clone to prevent managing of objects
					$.each($.extend(true, {}, endpoints), function(i, obj) {
						obj.name = self.i18n.active().oldCallflows.undefined_device;
						selected_endpoints[obj.id] = obj;
					});
				}

				$.each(data, function(i, obj) {
					obj.endpoint_type = 'device';
					if(obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					}
					else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_devices.push(obj);
					}
				});

				unselected_devices = monster.util.sort(unselected_devices);

				self.groupsGroupList(function(_data) {
					$.each(_data, function(i, obj) {
						obj.endpoint_type = 'group';
						if(obj.id in selected_endpoints) {
							selected_endpoints[obj.id].endpoint_type = 'group',
							selected_endpoints[obj.id].name = obj.name;
						}
						else {
							obj.delay = default_delay;
							obj.timeout = default_timeout;
							unselected_groups.push(obj);
						}
					});

					unselected_groups = monster.util.sort(unselected_groups);

					self.groupsUserList(function(_data, status) {
						$.each(_data, function(i, obj) {
							obj.name = obj.first_name + ' ' + obj.last_name;
							obj.endpoint_type = 'user';
							if(obj.id in selected_endpoints) {
								selected_endpoints[obj.id].endpoint_type = 'user',
								selected_endpoints[obj.id].name = obj.name;
							}
							else {
								obj.delay = default_delay;
								obj.timeout = default_timeout;
								unselected_users.push(obj);
							}
						});

						unselected_users = monster.util.sort(unselected_users);

						self.groupsMediaList(function(_data) {
							var media_array = _data.sort(function(a,b) {
								return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
							});


							popup_html = $(monster.template(self, 'groups-ring_group_dialog', {
								form: {
									name: node.getMetadata('name') || '',
									strategy: {
										items: [
											{
												id: 'simultaneous',
												name: self.i18n.active().oldCallflows.at_the_same_time
											},
											{
												id: 'single',
												name: self.i18n.active().oldCallflows.in_order
											}
										],
										selected: node.getMetadata('strategy') || 'simultaneous'
									},
									timeout: node.getMetadata('timeout') || '30',
									ringback: {
										items: $.merge([
											{
												id: 'default',
												name: self.i18n.active().oldCallflows.default,
												class: 'uneditable'
											},
											{
												id: 'silence_stream://300000',
												name: self.i18n.active().oldCallflows.silence,
												class: 'uneditable'
											}
										], media_array),
										selected: node.getMetadata('ringback') || 'default'
									}
								}
							}));
							$.each(unselected_groups, function() {
								$('#groups_pane .connect.left', popup_html).append($(monster.template(self, 'groups-ring_group_element', this)));
							});

							$.each(unselected_devices, function() {
								$('#devices_pane .connect.left', popup_html).append($(monster.template(self, 'groups-ring_group_element', this)));
							});

							$.each(unselected_users, function() {
								$('#users_pane .connect.left', popup_html).append($(monster.template(self, 'groups-ring_group_element', this)));
							});

							$.each(selected_endpoints, function() {
								//Check if user/device exists.
								if(this.endpoint_type) {
									$('.connect.right', popup_html).append($(monster.template(self, 'groups-ring_group_element', this)));
								}
							});

							$('#name', popup_html).bind('keyup blur change', function() {
								$('.column.right .title', popup_html).html(self.i18n.active().oldCallflows.ring_group_val + $(this).val());
							});

							$('#ringback', popup_html).change(function(e) {
								if($(this).find('option:selected').hasClass('uneditable')) {
									$('.media_action[data-action="edit"]', popup_html).hide();
								} else {
									$('.media_action[data-action="edit"]', popup_html).show();
								}
							});

							$('.media_action', popup_html).click(function(e) {
								var isCreation = $(this).data('action') === 'create',
									mediaData = isCreation ? {} : { id: $('#ringback', popup_html).val() };

								monster.pub('callflows.media.editPopup', {
									data: mediaData, 
									callback: function(_mediaData) {
										if(_mediaData.data && _mediaData.data.id) {
											if(isCreation) {
												$('#ringback', popup_html).append('<option value="'+_mediaData.data.id+'">'+_mediaData.data.name+'</option>');
											} else {
												$('#ringback option[value="'+_mediaData.data.id+'"]', popup_html).text(_mediaData.data.name);
											}
											$('#ringback', popup_html).val(_mediaData.data.id);
										}
									}
								});
							});

							$('ul.settings1 > li > a', popup_html).click(function(item) {
								$('.pane_content', popup_html).hide();

								//Reset Search field
								$('.searchfield', popup_html).val('');
								$('.column.left li', popup_html).show();

								$('ul.settings1 > li', popup_html).removeClass('current');

								var tab_id = $(this).attr('id');

								if(tab_id  === 'users_tab_link') {
									$('#users_pane', popup_html).show();
								}
								else if(tab_id === 'devices_tab_link') {
									$('#devices_pane', popup_html).show();
								}
								else if(tab_id === 'groups_tab_link') {
									$('#groups_pane', popup_html).show();
								}

								$(this).parent().addClass('current');
							});

							$('.searchsubmit2', popup_html).click(function() {
								$('.searchfield', popup_html).val('');
								$('.column li', popup_html).show();
							});

							$('#devices_pane .searchfield', popup_html).keyup(function() {
								$('#devices_pane .column.left li').each(function() {
									if($('.item_name', $(this)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
										$(this).hide();
									}
									else {
										$(this).show();
									}
								});
							});

							$('#users_pane .searchfield', popup_html).keyup(function() {
								$('#users_pane .column.left li').each(function() {
									if($('.item_name', $(this)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
										$(this).hide();
									}
									else {
										$(this).show();
									}
								});
							});

							$('#groups_pane .searchfield', popup_html).keyup(function() {
								$('#groups_pane .column.left li').each(function() {
									if($('.item_name', $(this)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
										$(this).hide();
									}
									else {
										$(this).show();
									}
								});
							});

							if($.isEmptyObject(selected_endpoints)) {
								$('.column.right .connect', popup_html).addClass('no_element');
							}
							else {
								$('.column.right .connect', popup_html).removeClass('no_element');
							}

							$('.column.left .options', popup_html).hide();
							$('.column.left .actions', popup_html).hide();

							$('.options .option.delay', popup_html).bind('keyup', function() {
								$(this).parents('li').data('delay', $(this).val());
							});

							$('.options .option.timeout', popup_html).bind('keyup', function() {
								$(this).parents('li').data('timeout', $(this).val());
							});

							$('#save_ring_group', popup_html).click(function() {
								var name = $('#name', popup_html).val(),
									global_timeout = 0,
									strategy = $('#strategy', popup_html).val(),
									ringback = $('#ringback', popup_html).val();

								endpoints = [];

								if(strategy === 'simultaneous') {
									var computeTimeout = function(delay, local_timeout, global_timeout) {
										var duration = delay + local_timeout;

										if(duration > global_timeout) {
											global_timeout = duration;
										}

										return global_timeout;
									}
								}
								else {
									var computeTimeout = function(delay, local_timeout, global_timeout) {
										global_timeout += delay + local_timeout;

										return global_timeout;
									}
								}

								$('.right .connect li', popup_html).each(function() {
									var item_data = this.dataset;
									delete item_data.owner_id;
									endpoints.push(item_data);
									global_timeout = computeTimeout(parseFloat(item_data.delay), parseFloat(item_data.timeout), global_timeout);
								});

								node.setMetadata('endpoints', endpoints);
								node.setMetadata('name', name);
								node.setMetadata('strategy', strategy);
								node.setMetadata('timeout', global_timeout);
								if(ringback === 'default') {
									node.deleteMetadata('ringback', ringback);
								} else {
									node.setMetadata('ringback', ringback);
								}

								node.caption = name;

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().oldCallflows.ring_group,
								beforeClose: function() {
									if(typeof callback == 'function') {
										callback();
									}
								}
							});

							// $('.scrollable', popup).jScrollPane({
							// 	horizontalDragMinWidth: 0,
							// 	horizontalDragMaxWidth: 0
							// });

							$('.connect', popup).sortable({
								connectWith: $('.connect.right', popup),
								zIndex: 2000,
								helper: 'clone',
								appendTo: $('.wrapper', popup),
								scroll: false,
								receive: function(ev, ui) {
									var data = ui.item[0].dataset,
										list_li = [],
										confirm_text;

									if(data.endpoint_type === 'device') {
										confirm_text = self.i18n.active().oldCallflows.the_owner_of_this_device_is_already;
										$('.connect.right li', popup_html).each(function() {
											if($(this).data('id') === data.owner_id) {
												list_li.push($(this));
											}
										});
									}
									else if(data.endpoint_type === 'user') {
										confirm_text = self.i18n.active().oldCallflows.this_user_has_already_some_devices;
										$('.connect.right li', popup_html).each(function() {
											if($(this).data('owner_id') === data.id) {
												list_li.push($(this));
											}
										});
									}

									if(list_li.length > 0) {
										monster.ui.confirm(confirm_text,
											function() {
												$.each(list_li, function() {
													remove_element(this);
												});
											},
											function() {
												remove_element(ui.item);
											}
										);
									}

									if($(this).hasClass('right')) {
										$('.options', ui.item).show();
										$('.actions', ui.item).show();
										//$('.item_name', ui.item).addClass('right');
										$('.column.right .connect', popup).removeClass('no_element');
									}
								}
							});

							$(popup_html).delegate('.trash', 'click', function() {
								var $parent_li = $(this).parents('li').first();
								remove_element($parent_li);
							});

							$('.pane_content', popup_html).hide();
							$('#users_pane', popup_html).show();
							if($('#ringback option:selected').hasClass('uneditable')) {
								$('.media_action[data-action="edit"]', popup_html).hide();
							} else {
								$('.media_action[data-action="edit"]', popup_html).show();
							}

							var remove_element = function(li) {
								var $parent_li = li;
								var data = $parent_li[0].dataset;
								data.name = jQuery.trim($('.item_name', $parent_li).html());
								$('#'+data.endpoint_type+'s_pane .connect.left', popup_html).append($(monster.template(self, 'groups-ring_group_element', data)));
								$parent_li.remove();

								if($('.connect.right li', popup_html).size() == 0) {
									$('.column.right .connect', popup).addClass('no_element');
								}

								if(data.name.toLowerCase().indexOf($('#'+data.endpoint_type+'s_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
									$('#'+data.id, popup_html).hide();
								}
							};
						});
					});
				});
			});
		},

		groupsDeviceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		groupsGroupList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'group.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		groupsUserList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		groupsMediaList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
