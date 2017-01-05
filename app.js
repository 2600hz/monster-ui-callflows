define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	require([
		'./submodules/misc/misc',
		'./submodules/blacklist/blacklist',
		'./submodules/conference/conference',
		'./submodules/device/device',
		'./submodules/directory/directory',
		'./submodules/faxbox/faxbox',
		'./submodules/groups/groups',
		'./submodules/media/media',
		'./submodules/menu/menu',
		'./submodules/resource/resource',
		'./submodules/timeofday/timeofday',
		'./submodules/user/user',
		'./submodules/vmbox/vmbox',
		'./submodules/featurecodes/featurecodes'
	]);

	var app = {
		name: 'callflows',

		css: [ 'app', 'icons' ],

		i18n: { 
			'en-US': { customCss: false }
		},

		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps 
		subscribe: {
			'callflows.fetchActions': 'define_callflow_nodes'
		},

		subModules: ['misc', 'blacklist', 'conference', 'device', 'directory', 'faxbox', 'groups', 'media', 'menu', 'resource', 'timeofday', 'user', 'vmbox', 'featurecodes'],

		appFlags: {
			flow: {},

			// For now we use that to only load the numbers classifiers the first time we load the app, since it is very unlikely to change often
			appData: {},

			showAllCallflows: (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin
		},

		actions: {},
		categories: {},
		flow: {},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function(callback) {
			var self = this;

			/* Used to init the auth token and account id of self app */
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		// Entry Point of the app
		render: function(container){
			var self = this,
				parent = _.isEmpty(container) ? $('#monster-content') : container;

			monster.pub('callflows.fetchActions', { actions: self.actions });

			self.renderEntityManager(parent);
		},

		renderCallflows: function(container){
			var self = this,
				callflowsTemplate = $(monster.template(self, 'callflow-manager'));

			self.bindCallflowsEvents(callflowsTemplate);

			self.repaintList({
				template: callflowsTemplate,
				callback: function() {
					(container)
						.empty()
						.append(callflowsTemplate);

					container.find('.search-query').focus();

					self.hackResize(callflowsTemplate);
				}
			});
		},

		bindCallflowsEvents: function(template) {
			var self = this,
				callflowList = template.find('.list-container .list'),
				isLoading = false,
				loader = $('<li class="content-centered list-loader"> <i class="fa fa-spinner fa-spin"></i></li>'),
				searchLink = $(monster.template(self, 'callflowList-searchLink'));

			// Add Callflow
			template.find('.list-add').on('click', function() {
				template.find('.callflow-content')
						.removeClass('listing-mode')
						.addClass('edition-mode');

				self.editCallflow();
			});

			// Edit Callflow
			callflowList.on('click', '.list-element', function() {
				var $this = $(this),
					callflowId = $this.data('id');

				template.find('.callflow-content')
					.removeClass('listing-mode')
					.addClass('edition-mode');

				self.editCallflow({ id: callflowId });
			});

			callflowList.on('scroll', function() {
				if(!isLoading && callflowList.data('next-key') && (callflowList.scrollTop() >= (callflowList[0].scrollHeight - callflowList.innerHeight() - 100))) {
					isLoading = true;
					callflowList.append(loader);

					self.listData({
						callback: function(callflowData) {
							var listCallflows = monster.template(self, 'callflowList', { callflows: callflowData.data });

							loader.remove();

							callflowList
									.append(listCallflows)
									.data('next-key', callflowData.next_start_key || null);

							isLoading = false;
						},
						nextStartKey: callflowList.data('next-key'),
						searchValue: callflowList.data('search-value')
					});
				}
			});

			// Search list
			template.find('.search-query').on('keyup', function() {
				var search = $(this).val();

				searchLink.find('.search-value').text(search);
				if(search) {
					$.each(template.find('.list-element'), function() {
						var $elem = $(this);
						if($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
					callflowList.prepend(searchLink);
				} else {
					template.find('.list-element').show();
					searchLink.remove();
				}
			});

			callflowList.on('click', '.search-link', function() {
				if(searchLink.hasClass('active')) {
					callflowList.data('search-value', null);
					searchLink.removeClass('active')
							  .remove();
					template.find('.search-query').prop('disabled', false)
												  .val('');
					self.repaintList({template: template});
				} else {
					var searchValue = searchLink.find('.search-value').text();
					searchLink.addClass('active')
							  .remove();
					callflowList.data('search-value', searchValue);

					template.find('.search-query').prop('disabled', true);

					self.repaintList({
						template: template,
						searchValue: searchValue,
						callback: function() {
							callflowList.prepend(searchLink);
						}
					});
				}
			});
		},

		renderEntityManager: function(container) {
			var self = this,
				entityActions = _.indexBy(_.filter(self.actions, function(action) {
					return action.hasOwnProperty('listEntities');
				}), 'module'),
				template = $(monster.template(self, 'layout', { actions: entityActions }));

			self.bindEntityManagerEvents({
				parent: container,
				template: template,
				actions: entityActions
			});

			container
				.empty()
				.append(template);
		},

		bindEntityManagerEvents: function(args) {
			var self = this,
				parent = args.parent,
				template = args.template,
				actions = args.actions,
				editEntity = function(type, id) {
					monster.pub(actions[type].editEntity, {
						data: id ? { id: id } : {},
						parent: template,
						target: template.find('.entity-edition .entity-content'),
						callbacks: {
							after_render: function() {
								$(window).trigger('resize');
								template.find('.entity-edition .callflow-content').animate({ scrollTop: 0 });
							},
							save_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type
								});
								editEntity(type, data.id);
							},
							delete_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type
								});
								template.find('.entity-edition .entity-content').empty();
							}
						}
					});
				};

			self.hackResize(template.find('.entity-edition'));

			template.find('.entity-manager .entity-element').on('click', function() {
				var $this = $(this);
				if($this.hasClass('callflow-element')) {
					self.renderCallflows(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				}
				else if($this.hasClass('account-element')) {
					self.renderAccountSettings(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				}
				else if($this.hasClass('feature-code-element')) {
					monster.pub('callflows.featurecode.render', template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				}
				else {
					var entityType = $this.data('type');
					template.find('.entity-edition .entity-header .entity-title').text(actions[entityType].name);
					self.refreshEntityList({
						template: template,
						actions: actions,
						entityType: entityType
					});
				}
			});

			template.on('click', '.entity-header .back-button', function() {
				template.find('.entity-edition .entity-content').empty();
				template.find('.entity-edition .list-container .list').empty();
				template.find('.entity-edition .search-query').val('');
				template.find('.callflow-edition').empty();

				template.find('.callflow-app-section').hide();
				template.find('.entity-manager').show();
			});

			template.find('.entity-edition .list-add').on('click', function() {
				var type = template.find('.entity-edition .list-container .list').data('type');
				editEntity(type);
			});

			template.find('.entity-edition .list-container .list').on('click', '.list-element', function() {
				var $this = $(this),
					id = $this.data('id'),
					type = $this.parents('.list').data('type');

				editEntity(type, id);
			});

			template.find('.entity-edition .search-query').on('keyup', function() {
				var search = $(this).val();
				if(search) {
					$.each(template.find('.entity-edition .list-element'), function() {
						var $elem = $(this);
						if($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
				} else {
					template.find('.entity-edition .list-element').show();
				}
			});
		},

		refreshEntityList: function(args) {
			var self = this,
				template = args.template,
				actions = args.actions,
				entityType = args.entityType,
				callback = args.callbacks;

			actions[entityType].listEntities(function(entities) {
				self.formatEntityData(entities, entityType);
				var listEntities = monster.template(self, 'entity-list', { entities: entities });

				template.find('.entity-edition .list-container .list')
						.empty()
						.append(listEntities)
						.data('type', entityType);

				template.find('.callflow-app-section').hide();
				template.find('.entity-edition').show();
				template.find('.search-query').focus();

				$(window).trigger('resize');

				callback && callback();
			});
		},

		formatEntityData: function(entities, entityType) {
			var self = this;
			_.each(entities, function(entity) {
				if(entity.first_name && entity.last_name) {
					entity.displayName = entity.first_name + ' ' + entity.last_name;
				} else if(entity.name) {
					entity.displayName = entity.name;
				} else {
					entity.displayName = entity.id;
				}

				switch(entityType) {
					case 'play': //media
						if(entity.media_source) {
							entity.additionalInfo = self.i18n.active().callflows.media.mediaSources[entity.media_source]
						}
						break;
				}
			});
		},

		renderAccountSettings: function(container) {
			var self = this,
				silenceMediaId = 'silence_stream://300000';
			self.loadAccountSettingsData(function(accountSettingsData) {
				var template = $(monster.template(self, 'accountSettings', $.extend(true, { silenceMedia: silenceMediaId }, accountSettingsData))),
					widgetBlacklist = self.renderBlacklists(template, accountSettingsData);

				template.find('.cid-number-select').chosen({ search_contains: true, width: '220px' });
				container.empty().append(template);
				self.bindAccountSettingsEvents(template, accountSettingsData, widgetBlacklist);
			});
		},

		renderBlacklists: function(template, accountSettingsData) {
			var self = this,
				items = [],
				selectedBlacklists = [];

			_.each(accountSettingsData.blacklists, function(blacklist) {
				items.push({
					key: blacklist.id,
					value: blacklist.name
				});
			});
			selectedBlacklists = _.filter(items, function(bl) {
				return (accountSettingsData.account.blacklists || []).indexOf(bl.key) >= 0;
			});

			// we return it so we can use the getSelectedItems() method later
			return monster.ui.linkedColumns(template.find('.blacklists-wrapper'), items, selectedBlacklists);
		},

		bindAccountSettingsEvents: function(template, data, widgetBlacklist) {
			var self = this,
				// account = args.account,
				mediaToUpload,
				closeUploadDiv = function(newMedia) {
					mediaToUpload = undefined;
					template.find('.upload-div input').val('');
					template.find('.upload-div').slideUp(function() {
						template.find('.upload-toggle').removeClass('active');
					});
					if(newMedia) {
						var mediaSelect = template.find('.media-dropdown');
						mediaSelect.append('<option value="'+newMedia.id+'">'+newMedia.name+'</option>');
						mediaSelect.val(newMedia.id);
					}
				};

			template.find('.upload-input').fileUpload({
				inputOnly: true,
				wrapperClass: 'file-upload input-append',
				btnText: self.i18n.active().callflows.accountSettings.musicOnHold.audioUploadButton,
				btnClass: 'monster-button',
				maxSize: 5,
				success: function(results) {
					mediaToUpload = results[0];
				},
				error: function(errors) {
					if(errors.hasOwnProperty('size') && errors.size.length > 0) {
						monster.ui.alert(self.i18n.active().callflows.accountSettings.musicOnHold.fileTooBigAlert);
					}
					template.find('.upload-div input').val('');
					mediaToUpload = undefined;
				}
			});

			template.find('.upload-toggle').on('click', function() {
				if($(this).hasClass('active')) {
					template.find('.upload-div').stop(true, true).slideUp();
				} else {
					template.find('.upload-div').stop(true, true).slideDown();
				}
			});

			template.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			template.find('.upload-submit').on('click', function() {
				if(mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: "upload",
								description: mediaToUpload.name
							}
						},
						success: function(data, status) {
							var media = data.data;
							self.callApi({
								resource: 'media.upload',
								data: {
									accountId: self.accountId,
									mediaId: media.id,
									data: mediaToUpload.file
								},
								success: function(data, status) {
									closeUploadDiv(media);
								},
								error: function(data, status) {
									self.callApi({
										resource: 'media.delete',
										data: {
											accountId: self.accountId,
											mediaId: media.id,
											data: {}
										},
										success: function(data, status) {}
									});
								}
							});
						}
					});
				} else {
					monster.ui.alert(self.i18n.active().callflows.accountSettings.musicOnHold.emptyUploadAlert);
				}
			});

			template.find('.account-settings-update').on('click', function() {
				var formData = monster.ui.getFormData('account_settings_form'),
					newData = $.extend(true, {}, data.account, formData);

				if(formData.music_on_hold.media_id === '') {
					delete newData.music_on_hold.media_id;
				}
				if(formData.caller_id.external.name === '') {
					delete newData.caller_id.external.name;
				}
				if(formData.caller_id.external.number === '') {
					delete newData.caller_id.external.number;
				}

				newData.blacklists = widgetBlacklist.getSelectedItems();

				self.callApi({
					resource: 'account.update',
					data: {
						accountId: newData.id,
						data: newData
					},
					success: function(data, status) {
						self.render();
					}
				});
			});
		},

		loadAccountSettingsData: function(callback) {
			var self = this;
			monster.parallel({
				account: function(parallelCallback) {
					self.callApi({
						resource: 'account.get',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				mediaList: function(parallelCallback) {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				numberList: function(parallelCallback) {
					self.callApi({
						resource: 'numbers.list',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data.numbers);
						}
					});
				},
				blacklists: function(parallelCallback) {
					self.callApi({
						resource: 'blacklist.list',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		hackResize: function(container) {
			var self = this;

			// Adjusting the layout divs height to always fit the window's size
			$(window).resize(function(e) {
				var $listContainer = container.find('.list-container'),
					$mainContent = container.find('.callflow-content'),
					$tools = container.find('.tools'),
					$flowChart = container.find('.flowchart'),
					contentHeight = window.innerHeight - $('#main_topbar').outerHeight(),
					contentHeightPx = contentHeight + 'px',
					innerContentHeightPx = (contentHeight-71) + 'px';

				$listContainer.css('height', window.innerHeight - $listContainer.position().top + 'px');
				$mainContent.css('height', contentHeightPx);
				$tools.css('height', innerContentHeightPx);
				$flowChart.css('height', innerContentHeightPx);
			});
			$(window).resize();
		},

		repaintList: function(args) {
			var self = this,
				args = args || {},
				template = args.template || $('#callflow_container'),
				callback = args.callback;

			self.listData({
				callback: function(callflowData) {
					var listCallflows = monster.template(self, 'callflowList', { callflows: callflowData.data });

					template.find('.list-container .list')
							.empty()
							.append(listCallflows)
							.data('next-key', callflowData.next_start_key || null);

					callback && callback(callflowData.data);
				},
				searchValue: args.searchValue
			});
		},

		listData: function(args) {
			var self = this,
				nextStartKey = args.nextStartKey,
				searchValue = args.searchValue,
				callback = args.callback,
				apiResource = 'callflow.list',
				apiData = {
					accountId: self.accountId
				};

			if(nextStartKey) {
				$.extend(true, apiData, {
					filters: {
						'start_key': encodeURIComponent(nextStartKey)
					}
				});
			}

			if(!self.appFlags.showAllCallflows) {
				$.extend(true, apiData, {
					filters: {
						'filter_not_ui_metadata.origin': [
							'voip',
							'callqueues'
						]
					}
				});
			}

			if(searchValue) {
				apiResource = 'callflow.searchByNameAndNumber';
				apiData.value = encodeURIComponent(searchValue);
			}

			self.callApi({
				resource: apiResource,
				data: apiData,
				success: function(callflowData) {
					var returnedCallflowData = self.formatData(callflowData);

					callback && callback(returnedCallflowData);
				}
			});
		},

		listNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId
				},
				success: function(numbers) {
					numbers = self.formatListSpareNumbers(numbers.data.numbers);

					callback && callback(numbers);
				}
			});
		},

		formatListSpareNumbers: function(numbers) {
			var self = this,
				listSpareNumbers = [];

			_.each(numbers, function(numberData, phoneNumber) {
				if(!numberData.hasOwnProperty('used_by') || numberData.used_by === '') {
					numberData.phoneNumber = phoneNumber;
					listSpareNumbers.push(numberData);
				}
			});

			return listSpareNumbers;
		},

		formatData: function(data) {
			var formattedList = [];

			_.each(data.data, function(callflow) {
				var listNumbers = (callflow.numbers || '-').toString(),
					isFeatureCode = callflow.featurecode !== false && !_.isEmpty(callflow.featurecode);

				if(!isFeatureCode) {
					if(callflow.name) {
						callflow.description = listNumbers;
						callflow.title = callflow.name;
					}
					else {
						callflow.title = listNumbers;
					}

					formattedList.push(callflow);
				}
			});

			formattedList.sort(function(a,b) {
				return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
			});

			data.data = formattedList;

			return data;
		},

		editCallflow: function(data) {
			var self = this;

			delete self.original_flow; // clear original_flow

			$('#callflow-view .callflow_help').hide();

			self.resetFlow();

			if(data && data.id) {
				self.callApi({
					resource: 'callflow.get', 
					data: {
						accountId: self.accountId,
						callflowId: data.id
					},
					success: function(callflow) {
						var callflow = callflow.data;

						//self.resetFlow();
						self.dataCallflow = callflow;

						self.flow.id = callflow.id;
						self.flow.name = callflow.name;
						self.flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
						self.flow.caption_map = callflow.metadata;

						if(callflow.flow.module != undefined) {
							self.flow.root = self.buildFlow(callflow.flow, self.flow.root, 0, '_');
						}

						self.flow.numbers = callflow.numbers || [];

						self.repaintFlow();
					}
				});
			}
			else {
				self.resetFlow();
				self.dataCallflow = {};
				self.repaintFlow();
			}

			self.renderButtons();
			self.renderTools();
		},

		renderButtons: function() {
			var self = this,
				buttons = $(monster.template(self, 'buttons'));

			$('.buttons').empty();

			$('.save', buttons).click(function() {
				if(self.flow.numbers && self.flow.numbers.length > 0) {
					self.save();
				}
				else {
					monster.ui.alert(self.i18n.active().oldCallflows.invalid_number + '<br/><br/>' + self.i18n.active().oldCallflows.please_select_valid_number);
				}
			});

			$('.delete', buttons).click(function() {
				if(self.flow.id) {
					monster.ui.confirm(self.i18n.active().oldCallflows.are_you_sure, function() {
						self.callApi({
							resource: 'callflow.delete',
							data: {
								accountId: self.accountId,
								callflowId: self.flow.id
							},
							success: function() {
								$('#ws_cf_flow').empty();
								$('.buttons').empty();
								$('#ws_cf_tools').empty();
								$('#hidden_callflow_warning').hide()

								self.repaintList();
								self.resetFlow();
							}
						});

						self.show_pending_change(false);
					});
				}
				else {
					monster.ui.alert(self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
				}
			});

			$('.buttons').append(buttons);
		},

		// Callflow JS code
		buildFlow: function (json, parent, id, key) {
			var self = this,
				branch = self.branch(self.construct_action(json));

			branch.data.data = ('data' in json) ? json.data : {};
			branch.id = ++id;
			branch.key = key;

			branch.caption = self.actions.hasOwnProperty(branch.actionName) ? self.actions[branch.actionName].caption(branch, self.flow.caption_map) : '';

			if(self.actions.hasOwnProperty(parent.actionName) && self.actions[parent.actionName].hasOwnProperty('key_caption')) {
				branch.key_caption = self.actions[parent.actionName].key_caption(branch, self.flow.caption_map);
			}

			if(json.hasOwnProperty('children')) {
				$.each(json.children, function(key, child) {
					branch = self.buildFlow(child, branch, id, key);
				});
			}

			parent.addChild(branch);

			return parent;
		},

		construct_action: function(json) {  
			var action = '';

			if('data' in json) {
				if('id' in json.data) {
					action = 'id=*,';
				}

				if('action' in json.data) {
					action += 'action=' + json.data.action + ',';
				}
			}

			if(action != '') {
				action = '[' + action.replace(/,$/, ']');
			}
			else {
				action = '[]';
			}

			return json.module + action;
		},

		resetFlow: function() {
			var self = this;

			self.flow = {};
			self.flow.root = self.branch('root'); // head of the flow tree
			self.flow.root.key = 'flow';
			self.flow.numbers = [];
			self.flow.caption_map = {};
			self.formatFlow();
		},

		formatFlow: function() {
			var self = this;

			self.flow.root.index(0);
			self.flow.nodes = self.flow.root.nodes();
		},

		// Create a new branch node for the flow
		branch: function(actionName) {
			var self = this;

			function branch(actionName) {
				var that = this,
					action = self.actions[actionName] || {};

				this.id = -1;
				this.actionName = actionName;
				this.module = action.module;
				this.key = '_';
				this.parent = null;
				this.children = [];
				this.data = {
					data: $.extend(true, {}, action.data)
				};
				this.caption = '';
				this.key_caption = '';

				this.potentialChildren = function() {
					var list = [];

					for(var i in self.actions) {
						if(self.actions[i].isUsable) {
							list[i] = i;
						}
					}

					for(var i in action.rules) {
						var rule = action.rules[i];

						switch (rule.type) {
							case 'quantity':
								if(this.children.length >= rule.maxSize) {
									list = [];
								}
								break;
						}
					}

					return list;
				}

				this.contains = function(branch) {
					var toCheck = branch;

					while(toCheck.parent) {
						if(this.id == toCheck.id) {
							return true;
						}
						else {
							toCheck = toCheck.parent;
						}
					}

					return false;
				}

				this.removeChild = function(branch) {
					$.each(this.children, function(i, child) {
						if(child.id == branch.id) {
							that.children.splice(i,1);
							return false;
						}
					});
				}

				this.addChild = function(branch) {
					if(!(branch.actionName in this.potentialChildren())) {
						return false;
					}

					if(branch.contains(this)) {
						return false;
					}

					if(branch.parent) {
						branch.parent.removeChild(branch);
					}

					branch.parent = this;

					this.children.push(branch);

					return true;
				}

				this.getMetadata = function(key) {
					var value;

					if('data' in this.data && key in this.data.data) {
						value = this.data.data[key];

						return (value == 'null') ? null : value;
					}

					return false;
				}

				this.setMetadata = function(key, value) {
					if(!('data' in this.data)) {
						this.data.data = {};
					}

					this.data.data[key] = (value == null) ? 'null' : value;
				}

				this.deleteMetadata = function(key) {
					if('data' in this.data && key in this.data.data) {
						delete this.data.data[key];
					}
				}

				this.index = function (index) {
					this.id = index;

					$.each(this.children, function() {
						index = this.index(index+1);
					});

					return index;
				}

				this.nodes = function() {
					var nodes = {};

					nodes[this.id] = this;

					$.each(this.children, function() {
						var buf = this.nodes();

						$.each(buf, function() {
							nodes[this.id] = this;
						});
					});

					return nodes;
				}

				this.serialize = function () {
					var json = $.extend(true, {}, this.data);

					json.module = this.module;

					json.children = {};

					$.each(this.children, function() {
						json.children[this.key] = this.serialize();
					});

					return json;
				}
			}

			return new branch(actionName);
		},

		repaintFlow: function() {
			var self = this;

			// Let it there for now, if we need to save callflows automatically again.
			/*if('savable' in THIS.flow) {
				THIS.save_callflow_no_loading();
			}*/

			self.flow.savable = true;

			var target = $('#ws_cf_flow').empty();

			target.append(this.getUIFlow());

			var current_flow = self.stringify_flow(self.flow);
			if(!('original_flow' in self) || self.original_flow.split('|')[0] !== current_flow.split('|')[0]) {
				self.original_flow = current_flow;
				self.show_pending_change(false);
			} else {
				self.show_pending_change(self.original_flow !== current_flow);
			}

			var metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.contains(['voip','migration','mobile'], metadata.origin);

			isHiddenCallflow ? $('#hidden_callflow_warning').show() : $('#hidden_callflow_warning').hide();
		},

		show_pending_change: function(pending_change) {
			var self = this;
			if(pending_change) {
				$('#pending_change', '#ws_callflow').show();
				$('.save', '#ws_callflow').addClass('pulse-box');
			} else {
				$('#pending_change', '#ws_callflow').hide();
				$('.save', '#ws_callflow').removeClass('pulse-box');
			}
		},

		stringify_flow: function(flow) {
			var s_flow = flow.id + "|" + (!flow.name ? 'undefined' : flow.name),
				first_iteration;
			s_flow += "|NUMBERS";
			$.each(flow.numbers, function(key, value) {
				s_flow += "|" + value;
			});
			s_flow += "|NODES";
			$.each(flow.nodes, function(key, value) {
				s_flow += "|" + key + "::";
				first_iteration = true;
				$.each(value.data.data, function(k,v) {
					if(!first_iteration) { s_flow += '//'; }
					else { first_iteration = false; }
					s_flow += k+':'+v;
				});
			});
			return s_flow;
		},

		getUIFlow: function() {
			var self = this;

			self.formatFlow();

			var layout = self.renderBranch(self.flow.root);

			$('.node', layout).hover(function() {
					$(this).addClass('over');
				},
				function() {
					$(this).removeClass('over');
				}
			);

			$('.node', layout).each(function() {
				var node = self.flow.nodes[$(this).attr('id')],
					$node = $(this),
					node_html;

				if (node.actionName == 'root') {
					$node.removeClass('icons_black root');
					node_html = $(monster.template(self, 'root', { name: self.flow.name || 'Callflow' }));

					$('.edit_icon', node_html).click(function() {
						self.flow = $.extend(true, { contact_list: { exclude: false }} , self.flow);

						var dialogTemplate = monster.template(self, 'editName', {
								name: self.flow.name,
								exclude: self.flow.contact_list.exclude,
								ui_is_main_number_cf: self.dataCallflow.hasOwnProperty('ui_is_main_number_cf') ? self.dataCallflow.ui_is_main_number_cf : false
							}),
							popup = monster.ui.dialog(dialogTemplate, {
							title: self.i18n.active().oldCallflows.popup_title
						});

						$('#add', popup).click(function() {
							var $callflow_name = $('#callflow_name', popup);
							if($callflow_name.val() != '') {
								self.flow.name = $callflow_name.val();
								$('.root .top_bar .name', layout).html(self.flow.name);
							}
							else {
								self.flow.name = '';
								$('.root .top_bar .name', layout).html('Callflow');
							}
							self.flow.contact_list = {
								exclude: $('#callflow_exclude', popup).prop('checked')
							};
							self.dataCallflow.ui_is_main_number_cf = $('#ui_is_main_number_cf', popup).prop('checked');
							//self.save_callflow_no_loading();
							self.repaintFlow();
							popup.dialog('close');
						});
					});

					$('.tooltip', node_html).click(function() {
						monster.ui.dialog(monster.template(self, 'help_callflow'));
					});

					for(var x, size = self.flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
						x = i * 2;

						var numbers = self.flow.numbers.slice(x, (x + 2 < size) ? x + 2 : size),
							row = monster.template(self, 'rowNumber', { numbers: numbers });

						node_html.find('.content')
								 .append(row);
					}

					$('.number_column.empty', node_html).click(function() {
						self.listNumbers(function(phoneNumbers) {
							var parsedNumbers = [];

							_.each(phoneNumbers, function(number) {
								if($.inArray(number.phoneNumber,self.flow.numbers) < 0) {
									parsedNumbers.push(number);
								}
							});

							var	popup_html = $(monster.template(self, 'addNumber', { phoneNumbers: parsedNumbers })),
								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.add_number
								});

							if(parsedNumbers.length === 0) {
								$('#list_numbers', popup_html).attr('disabled', 'disabled');
								$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup_html));
							}

							var refresh_numbers = function() {
								 self.listNumbers(function(refreshedNumbers) {
									$('#list_numbers', popup).empty();

									if(refreshedNumbers.length === 0) {
										$('#list_numbers', popup).attr('disabled', 'disabled');
										$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup));
									}
									else {
										$('#list_numbers', popup).removeAttr('disabled');
										$.each(refreshedNumbers, function(k, v) {
											$('<option value="'+v+'">'+v+'</option>').appendTo($('#list_numbers', popup));
										});
									}
								});
							};

							$('.extensions_content', popup).hide();

							$('input[name="number_type"]', popup).click(function() {
								if($(this).val() === 'your_numbers') {
									$('.list_numbers_content', popup).show();
									$('.extensions_content', popup).hide();
								}
								else {
									$('.extensions_content', popup).show();
									$('.list_numbers_content', popup).hide();
								}
							});

							popup.find('.buy-link').on('click', function(e) {
								e.preventDefault();
								monster.pub('common.buyNumbers', {
									searchType: $(this).data('type'),
									callbacks: {
										success: function(numbers) {
											_.each(numbers, function(number, k) {
												$('<option value="'+k+'">'+k+'</option>').appendTo($('#list_numbers', popup));
											});
										}
									}
								});
							});

							$('.add_number', popup).click(function(event) {
								event.preventDefault();
								var number = $('input[name="number_type"]:checked', popup).val() === 'your_numbers' ? $('#list_numbers option:selected', popup).val() : $('#add_number_text', popup).val();
								
								if(number !== 'select_none' && number !== '') {
									self.flow.numbers.push(number);
									popup.dialog('close');

									self.repaintFlow();
								}
								else {
									monster.ui.alert(self.i18n.active().oldCallflows.you_didnt_select);
								}
							});
						});
					});

					$('.number_column .delete', node_html).click(function() {
						var number = $(this).parent('.number_column').data('number') + '',
							index = $.inArray(number, self.flow.numbers);

						if(index >= 0) {
							self.flow.numbers.splice(index, 1);
						}

						self.repaintFlow();
					});

				}
				else {
					node_html = $(monster.template(self, 'node', {
						node: node,
						callflow: self.actions[node.actionName]
					}));

					// If an API request takes some time, the user can try to re-click on the element, we do not want to let that re-fire a request to the back-end. 
					// So we set a 500ms timer that will prevent any other interaction with the callflow element.
					var isAlreadyClicked = false;

					node_html.find('.module').on('click', function() {
						if(!isAlreadyClicked) {
							self.actions[node.actionName].edit(node, function() {
								self.repaintFlow();
							});

							isAlreadyClicked = true;

							setTimeout(function() {
								isAlreadyClicked = false;
							}, 500);
						}
					});
				}

				$(this).append(node_html);

				$(this).droppable({
					drop: function (event, ui) {
						var target = self.flow.nodes[$(this).attr('id')],
							action;

						if (ui.draggable.hasClass('action')) {
							action = ui.draggable.attr('name'),

							branch = self.branch(action);
							branch.caption = self.actions[action].caption(branch, self.flow.caption_map);

							if (target.addChild(branch)) {
								if(branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {
									branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);

									self.actions[branch.parent.actionName].key_edit(branch, function() {
										self.actions[action].edit(branch, function() {
											self.repaintFlow();
										});
									});
								}
								else {
									self.actions[action].edit(branch, function() {
										self.repaintFlow();
									});
								}

								//This is just in case something goes wrong with the dialog
								self.repaintFlow();
							}
						}

						if (ui.draggable.hasClass('node')) {
							var branch = self.flow.nodes[ui.draggable.attr('id')];

							if (target.addChild(branch)) {
								// If we move a node, destroy its key
								branch.key = '_';

								if(branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {
									branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);
								}

								ui.draggable.remove();
								self.repaintFlow();
							}
						}
					}
				});

				// dragging the whole branch
				if($(this).attr('name') != 'root') {
					$(this).draggable({
						start: function () {
							var children = $(this).next(),
								t = children.offset().top - $(this).offset().top,
								l = children.offset().left - $(this).offset().left;

							self.enableDestinations($(this));

							$(this).attr('t', t); $(this).attr('l', l);
						},
						drag: function () {
							var children = $(this).next(),
								t = $(this).offset().top + parseInt($(this).attr('t')),
								l = $(this).offset().left + parseInt($(this).attr('l'));

							children.offset({ top: t, left: l });
						},
						stop: function () {
							self.disableDestinations();

							self.repaintFlow();
						}
					});
				}
			});

			$('.node-options .delete', layout).click(function() {
				var node = self.flow.nodes[$(this).attr('id')];

				if (node.parent) {
					node.parent.removeChild(node);

					self.repaintFlow();
				}
			});

			return layout;
		},

		renderBranch: function(branch) {
			var self = this,
				flow = $(monster.template(self, 'branch', {
					node: branch,
					display_key: branch.parent && ('key_caption' in self.actions[branch.parent.actionName])
				})),
				children;

			if(branch.parent && ('key_edit' in self.actions[branch.parent.actionName])) {
				$('.div_option', flow).click(function() {
					self.actions[branch.parent.actionName].key_edit(branch, function() {
						self.repaintFlow();
					});
				});
			}

			// This need to be evaluated before the children start adding content
			children = $('.children', flow);

			$.each(branch.children, function() {
				children.append(self.renderBranch(this));
			});

			return flow;
		},

		renderTools: function() {
			var self = this,
				advanced_cat = self.i18n.active().oldCallflows.advanced_cat,
				basic_cat = self.i18n.active().oldCallflows.basic_cat,
				dataTemplate = { categories: [] },
				categories = {},
				target,
				tools;

			categories[basic_cat] = [];
			categories[advanced_cat] = [];

			$.each(self.actions, function(i, data) {
				if('category' in data) {
					data.category in categories ? true : categories[data.category] = [];
					data.key = i;
					categories[data.category].push(data);
				}
			});

			$.each(categories, function(key, val) {
				if (key !== basic_cat && key !== advanced_cat) {
					dataTemplate.categories.push({ key: key, actions: val });
				}
			});

			dataTemplate.categories.sort(function(a, b){
				return a.key < b.key ? 1 : -1;
			});

			dataTemplate.categories.unshift({
					key: basic_cat,
					actions: categories[basic_cat]
				},
				{
					key: advanced_cat,
					actions: categories[advanced_cat]
				}
			);

			$.each(categories, function(idx, val) {
				val.sort(function(a, b){
					if (a.hasOwnProperty('weight')) {
						return a.weight > b.weight ? 1 : -1;
					}
				});
			});

			tools = $(monster.template(self, 'tools', dataTemplate));

			$('.tooltip', tools).click(function() {
				monster.ui.dialog(monster.template(self, 'help_callflow'));
			});

			// Set the basic drawer to open
			$('#Basic', tools).removeClass('inactive').addClass('active');

			$('.category .open', tools).click(function () {
				tools.find('.category')
					 .removeClass('active')
					 .addClass('inactive');

				$(this).parent('.category')
					 .removeClass('inactive')
					 .addClass('active');
			});

			var help_box = $('.callflow_helpbox_wrapper', '#callflow-view').first();

			$('.tool', tools).hover(
				function () {
					$(this).addClass('active');
					$('.tool_name', '#callflow-view').removeClass('active');
					$('.tool_name', $(this)).addClass('active');
					if($(this).attr('help')) {
						$('#help_box', help_box).html($(this).attr('help'));
						$('.callflow_helpbox_wrapper', '#callflow-view').css('top', $(this).offset().top - 72)
																		.show();
					}
				},
				function () {
					$(this).removeClass('active');
					$('.callflow_helpbox_wrapper', '#callflow-view').hide();
				}
			);

			function action (el) {
				el.draggable({
					start: function () {
						self.enableDestinations($(this));
						$(this).addClass('inactive');
					},
					drag: function () {
						$('.callflow_helpbox_wrapper', '#callflow-view').hide();
					},
					stop: function () {
						self.disableDestinations();
						$(this).removeClass('inactive');
					},
					containment: $('body'),
					helper: 'clone'
				});
			}



			$('.action', tools).each(function() {
				action($(this));
			});

			target = $('#ws_cf_tools').empty();
			target.append(tools);

			$('#ws_cf_tools', '#callflow-view').disableSelection();
		},

		enableDestinations: function(el) {
			var self = this;

			$('.node').each(function () {
				var activate = true,
					target = self.flow.nodes[$(this).attr('id')];

				if (el.attr('name') in target.potentialChildren()) {
					if (el.hasClass('node') && self.flow.nodes[el.attr('id')].contains(target)) {
						activate = false;
					}
				}
				else {
					activate = false;
				}

				if (activate) {
					$(this).addClass('active');
				}
				else {
					$(this).addClass('inactive');
					$(this).droppable('disable');
				}
			});
		},

		disableDestinations: function() {
			$('.node').each(function () {
				$(this).removeClass('active');
				$(this).removeClass('inactive');
				$(this).droppable('enable');
			});

			$('.tool').removeClass('active');
		},

		save: function() {
			var self = this;

			if(self.flow.numbers && self.flow.numbers.length > 0) {
				var data_request = {
						numbers: self.flow.numbers,
						flow: (self.flow.root.children[0] == undefined) ? {} : self.flow.root.children[0].serialize()
					};

				if(self.flow.name !== '') {
					data_request.name = self.flow.name;
				}
				else {
					delete data_request.name;
					delete self.dataCallflow.name;
				}

				if('contact_list' in self.flow) {
					data_request.contact_list = { exclude: self.flow.contact_list.exclude || false };
				}

				// We don't want to keep the old data from the flow, so we override it with what's on the current screen before the extend.
				self.dataCallflow.flow = data_request.flow;
				// Change dictated by the new field added by monster-ui. THis way we can potentially update callflows in Kazoo UI without breaking monster.
				data_request = $.extend(true, {}, self.dataCallflow, data_request);
				delete data_request.metadata;

				if(self.flow.id) {
					self.callApi({
						resource: 'callflow.update',
						data: {
							accountId: self.accountId,
							callflowId: self.flow.id,
							data: data_request
						},
						success: function(json) {
							self.repaintList();
							self.editCallflow({id: json.data.id});
						}
					});
				}
				else {
					self.callApi({
						resource: 'callflow.create',
						data: {
							accountId: self.accountId,
							data: data_request
						},
						success: function(json) {
							self.repaintList();
							self.editCallflow({id: json.data.id});
						}
					});
				}
			}
			else {
				monster.ui.alert(self.i18n.active().oldCallflows.you_need_to_select_a_number);
			}
		},

		winkstartTabs: function(template, advanced) {
			var buttons = template.find('.view-buttons'),
				tabs = template.find('.tabs');

			if(advanced) {
				buttons.find('.btn').removeClass('activate');
				buttons.find('.advanced').addClass('activate');
			} else {
				if(monster.config.advancedView) {
					buttons.find('.btn').removeClass('activate');
					buttons.find('.advanced').addClass('activate');
				} else {
					 tabs.hide('blind');
				}
			}

			if(tabs.find('li').length < 2){
				buttons.hide();
			}

			buttons.find('.basic').on('click', function(){
				var $this = $(this);

				if(!$this.hasClass('activate')){
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.find('li:first-child > a').trigger('click');
					tabs.hide('blind');
				}
			});

			buttons.find('.advanced').click(function(){
				var $this = $(this);

				if(!$this.hasClass('activate')){
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.show('blind');
				}
			});

			tabs.find('li').on('click', function(ev) { 
				ev.preventDefault();

				var $this = $(this),
					link = $this.find('a').attr('href');

				tabs.find('li').removeClass('active');
				template.find('.pill-content >').removeClass('active');

				$this.addClass('active');
				template.find(link).addClass('active');
			});
		},

		winkstartLinkForm: function(html) {
			$('input', html).bind('change.link keyup.link focus.link', function() {
				var input = $(this),
					name = input.attr('name'),
					type = input.attr('type'),
					value = input.val(),
					id = input.attr('id'),
					input_fields = $('input[name="' + name + '"]', html);

				if(input_fields.size() > 1) {
					if(type == 'checkbox'){
						input_fields = input_fields.filter('[value='+value+']');
						(input.attr('checked')) ? input_fields.attr('checked', 'checked') : input_fields.removeAttr('checked');
					}
					else {
						$.each(input_fields, function(k, v) {
							var element = $(v);

							if(element.attr('id') !== id) {
								element.val(value);
							}
						});
					}
				}
				else {
					input.unbind('.link');
				}
			});
		}
	};

	return app;
});
