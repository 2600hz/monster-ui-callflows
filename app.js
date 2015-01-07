define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		name: 'callflows',

		css: [ 'app', 'icons' ],

		i18n: { 
			'en-US': { customCss: false },
			'fr-FR': { customCss: false }
		},

		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps 
		subscribe: {
			'callflows.fetchActions': 'define_callflow_nodes'
		},

		subModules: ['misc', 'conference', 'device', 'directory', 'faxbox', 'groups', 'media', 'menu', 'resource', 'timeofday', 'user', 'vmbox'],

		appFlags: {
			flow: {},

			// For now we use that to only load the numbers classifiers the first time we load the app, since it is very unlikely to change often
			appData: {},
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
				skeletonTemplate = $(monster.template(self, 'layout')),
				parent = _.isEmpty(container) ? $('#monster-content') : container;

			monster.pub('callflows.fetchActions', { actions: self.actions });

			self.bindEvents(skeletonTemplate);

			self.repaintList(skeletonTemplate, function() {
				(parent)
					.empty()
					.append(skeletonTemplate);

				self.hackResize(skeletonTemplate);
			});
		},

		bindEvents: function(template) {
			var self = this;

			// Search list
			template.find('.search-query').on('keyup', function() {
				var $this = $(this),
					search = $this.val();

				if(search) {
					$.each(template.find('.list-element'), function() {
						var $elem = $(this);
						if($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
				} else {
					template.find('.list-element').show();
				}
			});

			// Add Callflow
			template.find('.list-add').on('click', function() {
				template.find('.callflow-content')
						.removeClass('listing-mode')
						.addClass('edition-mode');

				self.editCallflow();
			});

			// Edit Callflow
			template.find('.list-container .list').on('click', '.list-element', function() {
				var $this = $(this),
					callflowId = $this.data('id');

				template.find('.callflow-content')
					.removeClass('listing-mode')
					.addClass('edition-mode');

				self.editCallflow({ id: callflowId });
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
					contentHeight = window.innerHeight - $('#topbar').outerHeight(),
					contentHeightPx = contentHeight + 'px';

				$listContainer.css('height', contentHeight - $listContainer.position().top + 'px');
				$mainContent.css('height', contentHeightPx);
				$tools.css('height', contentHeightPx);
				$flowChart.css('height', contentHeightPx);
			});
			$(window).resize();
		},

		repaintList: function(template, callback) {
			var self = this
				template = template || $('#callflow_container');

			self.listData(function(callflows) {
				var listCallflows = monster.template(self, 'callflowList', { callflows: callflows });

				template.find('.list-container .list')
						.empty()
						.append(listCallflows);

				callback && callback(callflows);
			});
		},

		listData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId
				},
				success: function(callflows) {
					var returnedCallflows = self.formatData(callflows);

					callback && callback(returnedCallflows);
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
				if(numberData.hasOwnProperty('used_by') && numberData.used_by === '') {
					numberData.phoneNumber = phoneNumber;
					listSpareNumbers.push(numberData);
				}
			});

			return listSpareNumbers;
		},

		formatData: function(data) {
			var formattedList = [];

			_.each(data.data, function(callflow) {
				var listNumbers = callflow.numbers.toString() || '-',
					isFeatureCode = callflow.featurecode !== false && !_.isEmpty(callflow.featurecode);

				if(!isFeatureCode) {
					if(callflow.name) {
						callflow.description = listNumbers;
						callflow.title = callflow.name;
					}
					else {
						callflow.title = listNumbers
					}

					formattedList.push(callflow);
				}
			});

			formattedList.sort(function(a,b) {
				return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
			});

			return formattedList;
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

			$.each(json.children, function(key, child) {
				branch = self.buildFlow(child, branch, id, key);
			});

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

						var popup = monster.ui.dialog(monster.template(self, 'editName', { name: self.flow.name, exclude: self.flow.contact_list.exclude}), {
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

					$('.module', node_html).click(function() {
						self.actions[node.actionName].edit(node, function() {
							self.repaintFlow();
						});
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
				target,
				tools;

			/* Don't add categories here, this is just a hack to order the list on the right */
			self.categories = {};

			$.each(self.actions, function(i, data) {
				if('category' in data) {
					data.category in self.categories ? true : self.categories[data.category] = [];
					data.key = i;
					self.categories[data.category].push(data);
				}
			});

			var templateData = {
				categories: self.categories
			};

			tools = $(monster.template(self, 'tools', templateData));

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
						var clone = $(this).clone();

						self.enableDestinations($(this));

						action(clone);
						clone.addClass('inactive');
						clone.insertBefore($(this));

						$(this).addClass('active');
					},
					drag: function () {
						$('.callflow_helpbox_wrapper', '#callflow-view').hide();
					},
					stop: function () {
						self.disableDestinations();
						$(this).prev().removeClass('inactive');
						$(this).remove();
					}
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
		}
	};

	return app;
});
