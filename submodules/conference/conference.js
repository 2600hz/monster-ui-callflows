define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'conferenceDefineActions'
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

                        winkstart.request(true, 'conference.list', {
                                account_id: winkstart.apps['voip'].account_id,
                                api_url: winkstart.apps['voip'].api_url
                            },
                            function(data, status) {
                                var popup, popup_html;

                                popup_html = self.templates.conference_callflow.tmpl({
                                    _t: function(param){
                                        return window.translate['conference'][param];
                                    },
                                    items: winkstart.sort(data.data),
                                    selected: node.getMetadata('id') || '!'
                                });

                                if($('#conference_selector option:selected', popup_html).val() == undefined) {
                                    $('#edit_link', popup_html).hide();
                                }

                                $('.inline_action', popup_html).click(function(ev) {
                                    var _data = ($(this).dataset('action') == 'edit') ?
                                                    { id: $('#conference_selector', popup_html).val() } : {};

                                    ev.preventDefault();

                                    winkstart.publish('conference.popup_edit', _data, function(_data) {
                                        node.setMetadata('id', _data.data.id || 'null');

                                        node.caption = _data.data.name || '';

                                        popup.dialog('close');
                                    });
                                });

                                $('#add', popup_html).click(function() {
                                    node.setMetadata('id', $('#conference_selector', popup_html).val());

                                    node.caption = $('#conference_selector option:selected', popup_html).text();

                                    popup.dialog('close');
                                });

                                popup = winkstart.dialog(popup_html, {
                                    title: self.i18n.active().callflows.conference.conference,
                                    minHeight: '0',
                                    beforeClose: function() {
                                        if(typeof callback == 'function') {
                                            callback();
                                        }
                                    }
                                });
                            }
                        );
                    }
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

		miscDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				edit_page_group = function(node, callback) {
					var node = node,
						callback = callback;

					winkstart.request(true, 'device.list', {
							account_id: winkstart.apps['voip'].account_id,
							api_url: winkstart.apps['voip'].api_url
						},
						function(data, status) {
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

							$.each(data.data, function(i, obj) {
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

							unselected_devices = winkstart.sort(unselected_devices);

							winkstart.request('groups.list', {
									account_id: winkstart.apps['voip'].account_id,
									api_url: winkstart.apps['voip'].api_url
								},
								function(_data, status) {
									$.each(_data.data, function(i, obj) {
										obj.endpoint_type = 'group';
										if(obj.id in selected_endpoints) {
											selected_endpoints[obj.id].endpoint_type = 'group',
											selected_endpoints[obj.id].name = obj.name;
										}
										else {
											unselected_groups.push(obj);
										}
									});

									unselected_groups = winkstart.sort(unselected_groups);

									winkstart.request('user.list', {
											account_id: winkstart.apps['voip'].account_id,
											api_url: winkstart.apps['voip'].api_url
										},
										function(_data, status) {
											$.each(_data.data, function(i, obj) {
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
											unselected_users = winkstart.sort(unselected_users);

											popup_html = self.templates.page_group_dialog.tmpl({
												form: {
													name: node.getMetadata('name') || ''
												}
											});
											$.each(unselected_groups, function() {
												$('#groups_pane .connect.left', popup_html).append(self.templates.page_group_element.tmpl(self));
											});

											$.each(unselected_devices, function() {
												$('#devices_pane .connect.left', popup_html).append(self.templates.page_group_element.tmpl(self));
											});

											$.each(unselected_users, function() {
												$('#users_pane .connect.left', popup_html).append(self.templates.page_group_element.tmpl(self));
											});

											$.each(selected_endpoints, function() {
												//Check if user/device exists.
												if(self.endpoint_type) {
													$('.connect.right', popup_html).append(self.templates.page_group_element.tmpl(self));
												}
											});

											$('#name', popup_html).bind('keyup blur change', function() {
												$('.column.right .title', popup_html).html('Page Group - ' + $(self).val());
											});

											$('ul.settings1 > li > a', popup_html).click(function(item) {
												$('.pane_content', popup_html).hide();

												//Reset Search field
												$('.searchfield', popup_html).val('');
												$('.column.left li', popup_html).show();

												$('ul.settings1 > li', popup_html).removeClass('current');

												var tab_id = $(self).attr('id');

												if(tab_id  === 'users_tab_link') {
													$('#users_pane', popup_html).show();
												}
												else if(tab_id === 'devices_tab_link') {
													$('#devices_pane', popup_html).show();
												}
												else if(tab_id === 'groups_tab_link') {
													$('#groups_pane', popup_html).show();
												}

												$(self).parent().addClass('current');
											});

											$('.searchsubmit2', popup_html).click(function() {
												$('.searchfield', popup_html).val('');
												$('.column li', popup_html).show();
											});

											$('#devices_pane .searchfield', popup_html).keyup(function() {
												$('#devices_pane .column.left li').each(function() {
													if($('.item_name', $(self)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
														$(self).hide();
													}
													else {
														$(self).show();
													}
												});
											});

											$('#users_pane .searchfield', popup_html).keyup(function() {
												$('#users_pane .column.left li').each(function() {
													if($('.item_name', $(self)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
														$(self).hide();
													}
													else {
														$(self).show();
													}
												});
											});

											$('#groups_pane .searchfield', popup_html).keyup(function() {
												$('#groups_pane .column.left li').each(function() {
													if($('.item_name', $(self)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
														$(self).hide();
													}
													else {
														$(self).show();
													}
												});
											});

											if(jQuery.isEmptyObject(selected_endpoints)) {
												$('.column.right .connect', popup_html).addClass('no_element');
											}
											else {
												$('.column.right .connect', popup_html).removeClass('no_element');
											}

											$('.column.left .options', popup_html).hide();
											$('.column.left .actions', popup_html).hide();

											$('.options .option.delay', popup_html).bind('keyup', function() {
												$(self).parents('li').dataset('delay', $(self).val());
											});

											$('.options .option.timeout', popup_html).bind('keyup', function() {
												$(self).parents('li').dataset('timeout', $(self).val());
											});

											$('#save_ring_group', popup_html).click(function() {
												var name = $('#name', popup_html).val();

												endpoints = [];

												$('.right .connect li', popup_html).each(function() {
													var item_data = $(self).dataset();
													delete item_data.owner_id;
													endpoints.push(item_data);
												});

												node.setMetadata('endpoints', endpoints);
												node.setMetadata('name', name);

												node.caption = name;

												popup.dialog('close');
											});

											popup = winkstart.dialog(popup_html, {
												title: self.i18n.active().oldCallflows.page_group_title,
												beforeClose: function() {
													if(typeof callback == 'function') {
														callback();
													}
												}
											});

											$('.scrollable', popup).jScrollPane({
												horizontalDragMinWidth: 0,
												horizontalDragMaxWidth: 0
											});

											$('.connect', popup).sortable({
												connectWith: $('.connect.right', popup),
												zIndex: 2000,
												helper: 'clone',
												appendTo: $('.wrapper', popup),
												scroll: false,
												receive: function(ev, ui) {
													var data = ui.item.dataset(),
														list_li = [],
														confirm_text;

													if(data.endpoint_type === 'device') {
														confirm_text = self.i18n.active().oldCallflows.the_owner_of_self_device_is_already;
														$('.connect.right li', popup_html).each(function() {
															if($(self).dataset('id') === data.owner_id) {
																list_li.push($(self));
															}
														});
													}
													else if(data.endpoint_type === 'user') {
														confirm_text = self.i18n.active().oldCallflows.self_user_has_already_some_devices;
														$('.connect.right li', popup_html).each(function() {
															if($(self).dataset('owner_id') === data.id) {
																list_li.push($(self));
															}
														});
													}

													if(list_li.length > 0) {
														winkstart.confirm(confirm_text,
															function() {
																$.each(list_li, function() {
																	remove_element(self);
																});
															},
															function() {
																remove_element(ui.item);
															}
														);
													}

													if($(self).hasClass('right')) {
														$('.options', ui.item).show();
														$('.actions', ui.item).show();
														//$('.item_name', ui.item).addClass('right');
														$('.column.right .connect', popup).removeClass('no_element');
													}
												}
											});

											$(popup_html).delegate('.trash', 'click', function() {
												var $parent_li = $(self).parents('li').first();
												remove_element($parent_li);
											});

											$('.pane_content', popup_html).hide();
											$('#users_pane', popup_html).show();

											var remove_element = function(li) {
												var $parent_li = li;
												var data = $parent_li.dataset();
												data.name = jQuery.trim($('.item_name', $parent_li).html());
												$('#'+data.endpoint_type+'s_pane .connect.left', popup_html).append(self.templates.page_group_element.tmpl(data));
												$parent_li.remove();

												if($('.connect.right li', popup_html).size() == 0) {
													$('.column.right .connect', popup).addClass('no_element');
												}

												if(data.name.toLowerCase().indexOf($('#'+data.endpoint_type+'s_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
													$('#'+data.id, popup_html).hide();
												}
											};
										}
									);
								}
							);
						}
					);
				},
				edit_ring_group = function(node, callback) {
					var default_timeout = '20',
						default_delay = '0',
						node = node,
						callback = callback;

					winkstart.request(true, 'device.list', {
							account_id: winkstart.apps['voip'].account_id,
							api_url: winkstart.apps['voip'].api_url
						},
						function(data, status) {
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

							$.each(data.data, function(i, obj) {
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

							unselected_devices = winkstart.sort(unselected_devices);

							winkstart.request('groups.list', {
									account_id: winkstart.apps['voip'].account_id,
									api_url: winkstart.apps['voip'].api_url
								},
								function(_data, status) {
									$.each(_data.data, function(i, obj) {
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

									unselected_groups = winkstart.sort(unselected_groups);

									winkstart.request('user.list', {
											account_id: winkstart.apps['voip'].account_id,
											api_url: winkstart.apps['voip'].api_url
										}, function(_data, status) {
											$.each(_data.data, function(i, obj) {
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

											unselected_users = winkstart.sort(unselected_users);

											winkstart.request('media.list', {
													account_id: winkstart.apps['voip'].account_id,
													api_url: winkstart.apps['voip'].api_url
												},
												function(_data, status) {
													var media_array = _data.data.sort(function(a,b) {
														return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
													});

													popup_html = self.templates.ring_group_dialog.tmpl({
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
													});
													$.each(unselected_groups, function() {
														$('#groups_pane .connect.left', popup_html).append(self.templates.ring_group_element.tmpl(self));
													});

													$.each(unselected_devices, function() {
														$('#devices_pane .connect.left', popup_html).append(self.templates.ring_group_element.tmpl(self));
													});

													$.each(unselected_users, function() {
														$('#users_pane .connect.left', popup_html).append(self.templates.ring_group_element.tmpl(self));
													});

													$.each(selected_endpoints, function() {
														//Check if user/device exists.
														if(self.endpoint_type) {
															$('.connect.right', popup_html).append(self.templates.ring_group_element.tmpl(self));
														}
													});

													$('#name', popup_html).bind('keyup blur change', function() {
														$('.column.right .title', popup_html).html(self.i18n.active().oldCallflows.ring_group_val + $(self).val());
													});

													$('#ringback', popup_html).change(function(e) {
														if($(self).find('option:selected').hasClass('uneditable')) {
															$('.media_action[data-action="edit"]', popup_html).hide();
														} else {
															$('.media_action[data-action="edit"]', popup_html).show();
														}
													});

													$('.media_action', popup_html).click(function(e) {
														var isCreation = $(self).data('action') === 'create',
															mediaData = isCreation ? {} : { id: $('#ringback', popup_html).val() };

														winkstart.publish('media.popup_edit', mediaData, function(_mediaData) {
															if(_mediaData.data && _mediaData.data.id) {
																if(isCreation) {
																	$('#ringback', popup_html).append('<option value="'+_mediaData.data.id+'">'+_mediaData.data.name+'</option>');
																} else {
																	$('#ringback option[value="'+_mediaData.data.id+'"]', popup_html).text(_mediaData.data.name);
																}
																$('#ringback', popup_html).val(_mediaData.data.id);
															}
														});
													});

													$('ul.settings1 > li > a', popup_html).click(function(item) {
														$('.pane_content', popup_html).hide();

														//Reset Search field
														$('.searchfield', popup_html).val('');
														$('.column.left li', popup_html).show();

														$('ul.settings1 > li', popup_html).removeClass('current');

														var tab_id = $(self).attr('id');

														if(tab_id  === 'users_tab_link') {
															$('#users_pane', popup_html).show();
														}
														else if(tab_id === 'devices_tab_link') {
															$('#devices_pane', popup_html).show();
														}
														else if(tab_id === 'groups_tab_link') {
															$('#groups_pane', popup_html).show();
														}

														$(self).parent().addClass('current');
													});

													$('.searchsubmit2', popup_html).click(function() {
														$('.searchfield', popup_html).val('');
														$('.column li', popup_html).show();
													});

													$('#devices_pane .searchfield', popup_html).keyup(function() {
														$('#devices_pane .column.left li').each(function() {
															if($('.item_name', $(self)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
																$(self).hide();
															}
															else {
																$(self).show();
															}
														});
													});

													$('#users_pane .searchfield', popup_html).keyup(function() {
														$('#users_pane .column.left li').each(function() {
															if($('.item_name', $(self)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
																$(self).hide();
															}
															else {
																$(self).show();
															}
														});
													});

													$('#groups_pane .searchfield', popup_html).keyup(function() {
														$('#groups_pane .column.left li').each(function() {
															if($('.item_name', $(self)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
																$(self).hide();
															}
															else {
																$(self).show();
															}
														});
													});

													if(jQuery.isEmptyObject(selected_endpoints)) {
														$('.column.right .connect', popup_html).addClass('no_element');
													}
													else {
														$('.column.right .connect', popup_html).removeClass('no_element');
													}

													$('.column.left .options', popup_html).hide();
													$('.column.left .actions', popup_html).hide();

													$('.options .option.delay', popup_html).bind('keyup', function() {
														$(self).parents('li').dataset('delay', $(self).val());
													});

													$('.options .option.timeout', popup_html).bind('keyup', function() {
														$(self).parents('li').dataset('timeout', $(self).val());
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
															var item_data = $(self).dataset();
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

													popup = winkstart.dialog(popup_html, {
														title: self.i18n.active().oldCallflows.ring_group,
														beforeClose: function() {
															if(typeof callback == 'function') {
																callback();
															}
														}
													});

													$('.scrollable', popup).jScrollPane({
														horizontalDragMinWidth: 0,
														horizontalDragMaxWidth: 0
													});

													$('.connect', popup).sortable({
														connectWith: $('.connect.right', popup),
														zIndex: 2000,
														helper: 'clone',
														appendTo: $('.wrapper', popup),
														scroll: false,
														receive: function(ev, ui) {
															var data = ui.item.dataset(),
																list_li = [],
																confirm_text;

															if(data.endpoint_type === 'device') {
																confirm_text = self.i18n.active().oldCallflows.the_owner_of_self_device_is_already;
																$('.connect.right li', popup_html).each(function() {
																	if($(self).dataset('id') === data.owner_id) {
																		list_li.push($(self));
																	}
																});
															}
															else if(data.endpoint_type === 'user') {
																confirm_text = self.i18n.active().oldCallflows.self_user_has_already_some_devices;
																$('.connect.right li', popup_html).each(function() {
																	if($(self).dataset('owner_id') === data.id) {
																		list_li.push($(self));
																	}
																});
															}

															if(list_li.length > 0) {
																winkstart.confirm(confirm_text,
																	function() {
																		$.each(list_li, function() {
																			remove_element(self);
																		});
																	},
																	function() {
																		remove_element(ui.item);
																	}
																);
															}

															if($(self).hasClass('right')) {
																$('.options', ui.item).show();
																$('.actions', ui.item).show();
																//$('.item_name', ui.item).addClass('right');
																$('.column.right .connect', popup).removeClass('no_element');
															}
														}
													});

													$(popup_html).delegate('.trash', 'click', function() {
														var $parent_li = $(self).parents('li').first();
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
														var data = $parent_li.dataset();
														data.name = jQuery.trim($('.item_name', $parent_li).html());
														$('#'+data.endpoint_type+'s_pane .connect.left', popup_html).append(self.templates.ring_group_element.tmpl(data));
														$parent_li.remove();

														if($('.connect.right li', popup_html).size() == 0) {
															$('.column.right .connect', popup).addClass('no_element');
														}

														if(data.name.toLowerCase().indexOf($('#'+data.endpoint_type+'s_pane .searchfield', popup_html).val().toLowerCase()) == -1) {
															$('#'+data.id, popup_html).hide();
														}
													};
												}
											);
										}
									);
								}
							);
						}
					);
				};

			$.extend(callflow_nodes, {
				'root': {
					name: 'Root',
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable : 'false'
				},
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
					caption: function(node, caption_map) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						edit_ring_group(node, callback);
					}
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
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							return_value = '';

						if(id in caption_map && 'numbers' in caption_map[id]) {
							return_value = caption_map[id].numbers.toString();
						}

						return return_value;
					},
					edit: function(node, callback) {
						winkstart.request(true, 'callflow.list', {
								account_id: winkstart.apps['voip'].account_id,
								api_url: winkstart.apps['voip'].api_url
							},
							function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if(!self.featurecode && self.id != self.flow.id) {
										self.name = self.name ? self.name : ((self.numbers) ? self.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);

										_data.push(self);
									}
								});

								popup_html = self.templates.edit_dialog.tmpl({
									objects: {
										type: 'callflow',
										items: winkstart.sort(_data),
										selected: node.getMetadata('id') || ''
									}
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#object-selector', popup_html).val());

									node.caption = $('#object-selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = winkstart.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.callflow_title,
									beforeClose: function() {
										if(typeof callback == 'function') {
											callback();
										}
									}
								});
							}
						);
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
					caption: function(node, caption_map) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						edit_page_group(node, callback);
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
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
						caller_id_number_prefix: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					caption: function(node, caption_map) {
						return (node.getMetadata('caller_id_name_prefix') || '') + ' ' + (node.getMetadata('caller_id_number_prefix') || '');
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.prepend_cid_callflow.tmpl({
							data_cid: {
								'caller_id_name_prefix': node.getMetadata('caller_id_name_prefix') || '',
								'caller_id_number_prefix': node.getMetadata('caller_id_number_prefix') || ''
							}
						});

						$('#add', popup_html).click(function() {
							var cid_name_val = $('#cid_name_prefix', popup_html).val(),
								cid_number_val = $('#cid_number_prefix', popup_html).val();

							node.setMetadata('caller_id_name_prefix', cid_name_val);
							node.setMetadata('caller_id_number_prefix', cid_number_val);

							node.caption = cid_name_val + ' ' + cid_number_val;

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.prepend_caller_id_title,
							minHeight: '0',
							beforeClose: function() {
								if(typeof callback == 'function') {
									 callback();
								}
							}
						});

						if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if(typeof callback == 'function') {
							callback();
						}
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
					caption: function(node, caption_map) {
						return node.getMetadata('presence_id') || '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.presence_callflow.tmpl({
							data_presence: {
								'presence_id': node.getMetadata('presence_id') || '',
								'status': node.getMetadata('status') || 'busy'
							}
						});

						$('#add', popup_html).click(function() {
							var presence_id = $('#presence_id_input', popup_html).val();
							node.setMetadata('presence_id', presence_id);
							node.setMetadata('status', $('#presence_status option:selected', popup_html).val());

							node.caption = presence_id;

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.manual_presence_title,
							beforeClose: function() {
								if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return node.getMetadata('language') || '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.language_callflow.tmpl({
							data_language: {
								'language': node.getMetadata('language') || ''
							}
						});

						$('#add', popup_html).click(function() {
							var language = $('#language_id_input', popup_html).val();
							node.setMetadata('language', language);
							node.caption = language;

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.language_title,
							beforeClose: function() {
								if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						winkstart.parallel({
								groups: function(callback) {
									self.groups_list(function(groups) {
										callback(null, groups);
									});
								},
								users: function(callback) {
									self.users_list(function(users) {
										callback(null, users);
									});
								},
								devices: function(callback) {
									self.devices_list(function(devices) {
										callback(null, devices);
									});
								}
							},
							function(err, results) {
								var popup, popup_html;

								popup_html = self.templates.group_pickup.tmpl({
									data: {
										items: results,
										selected: node.getMetadata('device_id') || node.getMetadata('group_id') || node.getMetadata('user_id') || ''
									}
								});

								$('#add', popup_html).click(function() {
									var selector = $('#endpoint_selector', popup_html),
										id = selector.val(),
										name = selector.find('#'+id).html(),
										type = $('#'+ id, popup_html).data('type'),
										type_id = type.substring(type, type.length - 1) + '_id';

									/* Clear all the useless attributes */
									node.data.data = {};
									node.setMetadata(type_id, id);
									node.setMetadata('name', name);

									node.caption = name;

									popup.dialog('close');
								});

								popup = winkstart.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.select_endpoint_title,
									minHeight: '0',
									beforeClose: function() {
										if(typeof callback == 'function') {
											callback();
										}
									}
								});
							}
						);
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
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						winkstart.request('user.list', {
								account_id: winkstart.apps['voip'].account_id,
								api_url: winkstart.apps['voip'].api_url
							},
							function(data, status) {
								var popup, popup_html;

								$.each(data.data, function() {
									self.name = self.first_name + ' ' + self.last_name;
								});

								popup_html = self.templates.fax_callflow.tmpl({
									objects: {
										items: data.data,
										selected: node.getMetadata('owner_id') || '',
										t_38: node.getMetadata('media') && node.getMetadata('media').fax_option || false
									}
								});

								if($('#user_selector option:selected', popup_html).val() == undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(self).dataset('action') == 'edit') ?
													{ id: $('#user_selector', popup_html).val() } : {};

									ev.preventDefault();

									winkstart.publish('user.popup_edit', _data, function(_data) {
										node.setMetadata('owner_id', _data.data.id || 'null');

										popup.dialog('close');
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('owner_id', $('#user_selector', popup_html).val());
									node.setMetadata('media', {
										fax_option: $('#t_38_checkbox', popup_html).is(':checked')
									});
									popup.dialog('close');
								});

								popup = winkstart.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.select_user_title,
									minHeight: '0',
									beforeClose: function() {
										if(typeof callback == 'function') {
											callback();
										}
									}
								});
							}
						);
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
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.call_record_callflow.tmpl({
							data_call_record: {
								'format': node.getMetadata('format') || 'mp3',
								'url': node.getMetadata('url') || '',
								'time_limit': node.getMetadata('time_limit') || '600'
							}
						});

						$('#add', popup_html).click(function() {
							node.setMetadata('url', $('#url', popup_html).val());
							node.setMetadata('format', $('#format', popup_html).val());
							node.setMetadata('time_limit', $('#time_limit', popup_html).val());

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.start_call_recording,
							minHeight: '0',
							beforeClose: function() {
								if(typeof callback == 'function') {
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
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
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
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.pivot_callflow.tmpl({
							data_pivot: {
								'method': node.getMetadata('method') || 'get',
								'voice_url': node.getMetadata('voice_url') || '',
								'req_timeout': node.getMetadata('req_timeout') || '5',
								'req_format': node.getMetadata('req_format') || 'twiml'
							}
						});

						$('#add', popup_html).click(function() {
							node.setMetadata('voice_url', $('#pivot_voiceurl_input', popup_html).val());
							node.setMetadata('method', $('#pivot_method_input', popup_html).val());
							node.setMetadata('req_format', $('#pivot_format_input', popup_html).val());

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.pivot_title,
							minHeight: '0',
							beforeClose: function() {
								if(typeof callback == 'function') {
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
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = self.templates.disa_callflow.tmpl({
							data_disa: {
								'pin': node.getMetadata('pin') || '',
								'retries': node.getMetadata('retries') || '3'
							}
						});

						$('#add', popup_html).click(function() {
							var save_disa = function() {
								node.setMetadata('pin', $('#disa_pin_input', popup_html).val());
								node.setMetadata('retries', $('#disa_retries_input', popup_html).val());

								popup.dialog('close');
							};
							if($('#disa_pin_input', popup_html).val() == '') {
								winkstart.confirm(self.i18n.active().oldCallflows.not_setting_a_pin, function() {
									save_disa();
								});
							}
							else {
								save_disa();
							}
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.disa_title,
							minHeight: '0',
							beforeClose: function() {
								if(typeof callback == 'function') {
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
					caption: function(node, caption_map) {
						return self.i18n.active().oldCallflows.sip_code_caption + node.getMetadata('code');
					},
					edit: function(node, callback) {
						winkstart.request(true, 'callflow.list_media', {
								account_id: winkstart.apps['voip'].account_id,
								api_url: winkstart.apps['voip'].api_url
							},
							function(data, status) {
								var popup, popup_html;

								popup_html = self.templates.response_callflow.tmpl({
									response_data: {
										items: data.data,
										media_enabled: node.getMetadata('media') ? true : false,
										selected_media: node.getMetadata('media') || '',
										code: node.getMetadata('code') || '',
										message: node.getMetadata('message') || ''
									}
								});

								if($('#media_selector option:selected', popup_html).val() == undefined
								|| $('#media_selector option:selected', popup_html).val() == 'null') {
									$('#edit_link', popup_html).hide();
								}

								$('#media_selector', popup_html).change(function() {
									if($('#media_selector option:selected', popup_html).val() == undefined
									|| $('#media_selector option:selected', popup_html).val() == 'null') {
										$('#edit_link', popup_html).hide();
									} else {
										$('#edit_link', popup_html).show();
									}
								})

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(self).dataset('action') == 'edit') ?
													{ id: $('#media_selector', popup_html).val() } : {};

									ev.preventDefault();

									winkstart.publish('media.popup_edit', _data, function(_data) {
										node.setMetadata('media', _data.data.id || 'null');

										popup.dialog('close');
									});
								});

								$('#add', popup_html).click(function() {
									if($('#response_code_input', popup_html).val().match(/^[1-6][0-9]{2}$/)) {
										node.setMetadata('code', parseInt($('#response_code_input', popup_html).val(), 10));
										node.setMetadata('message', $('#response_message_input', popup_html).val());
										if($('#media_selector', popup_html).val() && $('#media_selector', popup_html).val() != 'null') {
											node.setMetadata('media', $('#media_selector', popup_html).val());
										} else {
											node.deleteMetadata('media');
										}

										node.caption = self.i18n.active().oldCallflows.sip_code_caption + $('#response_code_input', popup_html).val();

										popup.dialog('close');
									} else {
										winkstart.alert('error', self.i18n.active().oldCallflows.please_enter_a_valide_sip_code);
									}
								});

								popup = winkstart.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.response_title,
									minHeight: '0',
									beforeClose: function() {
										if(typeof callback == 'function') {
											callback();
										}
									}
								});
							}
						);
					}
				}
			});

			/* Migration callflows, fixes our goofs. To be removed eventually */
			$.extend(callflow_nodes, {
				'resource[]': {
					name: self.i18n.active().oldCallflows.resource_name,
					icon: 'resource',
					module: 'resources',
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isUsable: 'true',
					caption: function(node, caption_map) {
						winkstart.alert(self.i18n.active().oldCallflows.self_callflow_is_outdated);
						return '';
					},
					edit: function(node, callback) {
					}
				},
				'hotdesk[id=*,action=call]': {
					name: self.i18n.active().oldCallflows.hot_desking_name,
					icon: 'v_phone',
					module: 'hotdesk',
					data: {
						action: 'bridge',
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
						//Migration here:
						node.setMetadata('action', 'bridge');

						winkstart.alert(self.i18n.active().oldCallflows.self_callflow_is_outdated);
						return '';
					},
					edit: function(node, callback) {
					}
				}
			});
		}
	};

	return app;
});
