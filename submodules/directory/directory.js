define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'directoryDefineActions',
			'callflows.directory.edit': '_directoryEdit'
		},

		directoryRender: function(data, target, callbacks){
			var self = this,
				directory_html = $(monster.template(self, 'directory-edit', data)),
				directoryForm = directory_html.find('#directory-form');

			self.directoryRenderUserList(data, directory_html);

			monster.ui.validate(directoryForm, {
				rules: {
					'min_dtmf': { digits: true },
					'max_dtmf': { digits: true }
				}
			});

			$('*[rel=popover]:not([type="text"])', directory_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', directory_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(directory_html);

			$('.directory-save', directory_html).click(function(ev) {
				ev.preventDefault();
				var $this = $(this);

				if(!$this.hasClass('disabled')) {
					$this.addClass('disabled');
					if(monster.ui.valid(directoryForm)) {
						var form_data = monster.ui.getFormData('directory-form');

						self.directoryCleanFormData(form_data);

						var old_list = {},
							new_list = {};

						$('.rows .row:not(#row_no_data)', directory_html).each(function() {
							new_list[$(this).data('id')] = $('#user_callflow_id', $(this)).val();
						});

						data.field_data.user_list = {
							old_list: data.field_data.old_list,
							new_list: new_list
						};

						self.directorySave(form_data, data, callbacks.save_success);
					}
					else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.directory.there_were_errors_on_the_form);
					}
				}
			});

			$('.directory-delete', directory_html).click(function(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.directory.are_you_sure_you_want_to_delete, function() {
					self.directoryDelete(data.data.id, callbacks.delete_success);
				});
			});

			$('.add_user_div', directory_html).click(function() {
				var $user = $('#select_user_id', directory_html);
				var $callflow = $('#callflow_id', directory_html);

				if($user.val() != 'empty_option_user' && $callflow.val() != 'empty_option_callflow') {
					var user_id = $user.val(),
						user_data = {
							user_id: user_id,
							user_name: $('#option_user_'+user_id, directory_html).text(),
							callflow_id: $callflow.val(),
							field_data: {
								callflows: data.field_data.callflows
							},
							_t: function(param){
								return window.translate['directory'][param];
							}
						};

					if($('#row_no_data', directory_html).size() > 0) {
						$('#row_no_data', directory_html).remove();
					}

					$('.rows', directory_html).prepend(monster.template(self, 'directory-userRow', user_data));
					$('#option_user_'+user_id, directory_html).hide();

					$user.val('empty_option_user');
					$callflow.val('empty_option_callflow');
				}
				else {
					monster.ui.alert('warning', self.i18n.active().callflows.directory.noDataSelected);
				}
			});

			$(directory_html).delegate('.action_user.delete', 'click', function() {
				var user_id = $(this).data('id');
				//removes it from the grid
				$('#row_user_'+user_id, directory_html).remove();
				//re-add it to the dropdown
				$('#option_user_'+user_id, directory_html).show();
				//if grid empty, add no data line
				if($('.rows .row', directory_html).size() == 0) {
					$('.rows', directory_html).append(monster.template(self, 'directory-userRow'));
				}
			});

			(target)
				.empty()
				.append(directory_html);
		},

		directoryRenderUserList: function(data, parent) {
			var self = this;

			if(data.data.id) {
				if('users' in data.data && data.data.users.length > 0) {
					var user_item;
					$.each(data.field_data.users, function(k, v) {
						if(v.id in data.field_data.old_list) {
							user_item = {
								user_id: v.id,
								user_name: v.first_name + ' ' + v.last_name,
								callflow_id: data.field_data.old_list[v.id],
								field_data: {
									callflows: data.field_data.callflows
								}
							};

							$('.rows', parent).append(monster.template(self, 'directory-userRow', user_item));
							$('#option_user_'+v.id, parent).hide();
						}
					});
				}
				else {
					$('.rows', parent).empty()
									  .append(monster.template(self, 'directory-userRow'));
				}
			}
			else {
				$('.rows', parent).empty()
								  .append(monster.template(self,'directory-userRow'));
			}
		},

		// Added for the subscribed event to avoid refactoring directoryEdit
		_directoryEdit: function(args) {
			var self = this;
			self.directoryEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		directoryEdit: function(data, _parent, _target, _callbacks, data_defaults){
			var self = this,
				parent = _parent || $('#directory-content'),
				target = _target || $('#directory-view', parent),
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
						min_dtmf: '3',
						max_dtmf: '0',
						sort_by: 'last_name',
						confirm_match: false
					}, data_defaults || {}),
					field_data: {
						sort_by: {
							'first_name': self.i18n.active().callflows.directory.first_name,
							'last_name': self.i18n.active().callflows.directory.last_name
						}
					}
				};

			monster.parallel({
					callflow_list: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: 'false'
								}
							},
							success: function(callflows) {
								var list_callflows = [];
								$.each(callflows.data, function() {
									if(this.featurecode == false) {
										list_callflows.push(this);
									}
								});

								list_callflows.sort(function(a,b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName;
								});

								defaults.field_data.callflows = list_callflows;

								callback(null, callflows);
							}
						});
					},
					user_list: function(callback) {
						self.callApi({
							resource: 'user.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: 'false'
								}
							},
							success: function(users) {
								users.data.sort(function(a,b) {
									var aName = (a.first_name + ' ' + a.last_name).toLowerCase(),
										bName = (b.first_name + ' ' + b.last_name).toLowerCase();

									return aName > bName;
								});

								defaults.field_data.users = users.data;

								callback(null, users);
							}
						});
					},
					directory_get: function(callback) {
						if(typeof data === 'object' && data.id) {
							self.directoryGet(data.id, function(directory, status) {
									defaults.field_data.old_list = {};

									if('users' in directory) {
										$.each(directory.users, function(k, v) {
											defaults.field_data.old_list[v.user_id] = v.callflow_id;
										});
									}

									callback(null, directory);
								}
							);
						}
						else {
							callback(null, {});
						}
					}
				},
				function(err, results) {
					var render_data = defaults;

					if(typeof data === 'object' && data.id) {
						render_data = $.extend(true, defaults, { data: results.directory_get });
					}

					self.directoryRender(render_data, target, callbacks);

					if(typeof callbacks.after_render == 'function') {
						callbacks.after_render();
					}
				}
			);
		},

		directoryPopupEdit: function(args) {
			var self = this,
				popup, 
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			self.directoryEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.directory.edit_directory : self.i18n.active().callflows.directory.create_directory
					});
				}
			}, data_defaults);
		},

		directoryNormalizeData: function(form_data) {
			delete form_data.users;
			return form_data;
		},

		directoryCleanFormData: function(form_data) {
			if(!(form_data.max_dtmf > 0)) {
				delete form_data.max_dtmf;
			}

			delete form_data.user_callflow_id;
			delete form_data.user_id;
			delete form_data.callflow_id;
		},

		directorySave: function(form_data, data, success) {
			var self = this,
				normalized_data = self.directoryNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data == 'object' && data.data.id) {
				self.directoryUpdate(normalized_data, function(_data, status) {
					self.directoryUpdateUsers(data.field_data.user_list, _data.id, function() {
						success && success(_data, status, 'update');
					});
				})
			}
			else {
				self.directoryCreate(normalized_data, function(_data, status) {
					self.directoryUpdateUsers(data.field_data.user_list, _data.id, function() {
						success && success(_data, status, 'create');
					});
				});
			}
		},

		directoryUpdateSingleUser: function(user_id, directory_id, callflow_id, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: user_id
				},
				success: function(_data, status) {
					if(callflow_id) {
						if(!_data.data.directories || $.isArray(_data.data.directories)) {
							_data.data.directories = {};
						}
						_data.data.directories[directory_id] = callflow_id;
					}
					else {
						delete _data.data.directories[directory_id];
					}

					self.callApi({
						resource: 'user.update',
						data: {
							accountId: self.accountId,
							userId: user_id,
							data: _data.data
						},
						success: callback
					});
				}
			});
		},

		directoryUpdateUsers: function(data, directory_id, success) {
			var old_directory_user_list = data.old_list,
				new_directory_user_list = data.new_list,
				self = this,
				users_updated_count = 0,
				users_count = 0,
				callback = function() {
					users_updated_count++;
					if(users_updated_count >= users_count) {
						success();
					}
				};

			if(old_directory_user_list) {
				$.each(old_directory_user_list, function(k, v) {
					if(!(k in new_directory_user_list)) {
						//Request to update user without this directory.
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, undefined, callback);
					}
				});

				$.each(new_directory_user_list, function(k, v) {
					if(k in old_directory_user_list) {
						if(old_directory_user_list[k] != v) {
							//Request to update user
							users_count++;
							self.directoryUpdateSingleUser(k, directory_id, v, callback);
						}
						//else it has not been updated
					}
					else {
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, v, callback);
					}
				});
			}
			else {
				if(new_directory_user_list) {
					$.each(new_directory_user_list, function(k, v) {
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, v, callback);
					});
				}
			}

			if(users_count === 0) {
				success();
			}
		},

		directoryDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'directory[id=*]': {
					name: self.i18n.active().callflows.directory.directory,
					icon: 'book',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'directory',
					tip: self.i18n.active().callflows.directory.directory_tip,
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
					weight: 160,
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

						self.directoryList(function(directories) {
							var popup, popup_html;

							popup_html = $(monster.template(self, 'directory-callflowEdit', {
								items: monster.util.sort(directories),
								selected: node.getMetadata('id') || ''
							}));

							if($('#directory_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') == 'edit') ?
												{ id: $('#directory_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.directoryPopupEdit({
									data: _data,
									callback: function(_data) {
										node.setMetadata('id', _data.data.id || 'null');

										node.caption = _data.data.name || '';

										popup.dialog('close');
									}
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#directory_selector', popup).val());

								node.caption = $('#directory_selector option:selected', popup).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.directory.directory_title,
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
							resource: 'directory.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.directory.edit'
				}
			});
		},

		directoryList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryGet: function(directoryId, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.get',
				data: {
					accountId: self.accountId,
					directoryId: directoryId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.update',
				data: {
					accountId: self.accountId,
					directoryId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryDelete: function(directoryId, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.delete',
				data: {
					accountId: self.accountId,
					directoryId: directoryId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
