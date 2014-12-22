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
					callflow.description = callflow.name;
					callflow.title = listNumbers;

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

			self._resetFlow();

			if(data && data.id) {
				self.callApi({
					resource: 'callflow.get', 
					data: {
						accountId: self.accountId,
						callflowId: data.id
					},
					success: function(callflow) {
						var callflow = callflow.data;

						//self._resetFlow();
						self.dataCallflow = callflow;

						self.flow.id = callflow.id;
						self.flow.name = callflow.name;
						self.flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
						self.flow.caption_map = callflow.metadata;

						if(callflow.flow.module != undefined) {
							self.flow.root = self.buildFlow(callflow.flow, self.flow.root, 0, '_');
						}

						self.flow.numbers = callflow.numbers || [];

						self.renderFlow();
					}
				});
			}
			else {
				self._resetFlow();
				self.dataCallflow = {};
				self.renderFlow();

			}

			self.renderButtons();
			self.renderTools();
		},

		renderButtons: function() {
			var self = this,
				buttons_html = $(monster.template(self, 'buttons'));

			if(self.dataCallflow && self.dataCallflow.ui_metadata && self.dataCallflow.ui_metadata.ui === 'monster-ui') {
				buttons_html.find('.save').addClass('disabled');
			}

			$('.buttons').empty();

			$('.save', buttons_html).click(function() {
				if(self.dataCallflow && self.dataCallflow.ui_metadata && self.dataCallflow.ui_metadata.ui === 'monster-ui') {
					monster.ui.alert(self.i18n.active().oldCallflows.monster_callflow_error);
				}
				else if(self.flow.numbers && self.flow.numbers.length > 0) {
					self.save();
				}
				else {
					monster.ui.alert(self.i18n.active().oldCallflows.invalid_number + '<br/><br/>' + self.i18n.active().oldCallflows.please_select_valid_number);
				}
			});

			$('.delete', buttons_html).click(function() {
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
								self._resetFlow();
							}
						});

						self.show_pending_change(false);
					});
				}
				else {
					monster.ui.alert(self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
				}
			});

			$('.buttons').append(buttons_html);
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

		_resetFlow: function() {
			var self = this;

			self.flow = {};
			self.flow.root = self.branch('root'); // head of the flow tree
			self.flow.root.key = 'flow';
			self.flow.numbers = [];
			self.flow.caption_map = {};
			self._formatFlow();
		},

		_formatFlow: function() {
			var self = this;

			self.flow.root.index(0);
			self.flow.nodes = self.flow.root.nodes();
		},

	 // Create a new branch node for the flow
		branch: function(actionName) {
			var self = this;

			function branch(actionName) {
				var that = this,
					action = self.actions[this.actionName] || {};

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

		renderFlow: function() {
            var self = this;

            // Let it there for now, if we need to save callflows automatically again.
            /*if('savable' in THIS.flow) {
                THIS.save_callflow_no_loading();
            }*/

            self.flow.savable = true;

            var target = $('#ws_cf_flow').empty();

            target.append(this.renderFlowUnderscore());

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


		renderFlowUnderscore: function() {
			var self = this;

			self._formatFlow();

			var layout = self._renderBranch(self.flow.root);

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

						var popup = monster.ui.dialog(monster.template(self, 'edit_name', { name: self.flow.name, exclude: self.flow.contact_list.exclude}), {
							width: '310px',
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
							self.renderFlow();

							popup.dialog('close');
						});
					});

					$('.tooltip', node_html).click(function() {
						monster.ui.dialog(monster.template(self, 'help_callflow'));
					});

					for(var x, size = self.flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
						x = i * 2;

						var numbers = self.flow.numbers.slice(x, (x + 2 < size) ? x + 2 : size),
							row = monster.template(self, 'num_row', { numbers: numbers });

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

							console.log(parsedNumbers);

							var	popup_html = $(monster.template(self, 'add_number', { phoneNumbers: parsedNumbers })),
								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.add_number
								});

							console.log(popup);

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

									self.renderFlow();
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

						self.renderFlow();
					});

				}
				else {
					node_html = $(monster.template(self, 'node', {
						node: node,
						callflow: self.actions[node.actionName]
					}));

					$('.module', node_html).click(function() {
						self.actions[node.actionName].edit(node, function() {
							self.renderFlow();
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
											self.renderFlow();
										});
									});
								}
								else {
									self.actions[action].edit(branch, function() {
										self.renderFlow();
									});
								}

								//This is just in case something goes wrong with the dialog
								self.renderFlow();
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
								self.renderFlow();
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

							self._enableDestinations($(this));

							$(this).attr('t', t); $(this).attr('l', l);
						},
						drag: function () {
							var children = $(this).next(),
								t = $(this).offset().top + parseInt($(this).attr('t')),
								l = $(this).offset().left + parseInt($(this).attr('l'));

							children.offset({ top: t, left: l });
						},
						stop: function () {
							self._disableDestinations();

							self.renderFlow();
						}
					});
				}
			});

			$('.node-options .delete', layout).click(function() {
				var node = self.flow.nodes[$(this).attr('id')];

				if (node.parent) {
					node.parent.removeChild(node);

					self.renderFlow();
				}
			});

			return layout;
		},

		_renderBranch: function(branch) {
			var self = this,
				flow = $(monster.template(self, 'branch', {
					node: branch,
					display_key: branch.parent && ('key_caption' in self.actions[branch.parent.actionName])
				})),
				children;

			if(branch.parent && ('key_edit' in self.actions[branch.parent.actionName])) {
				$('.div_option', flow).click(function() {
					self.actions[branch.parent.actionName].key_edit(branch, function() {
						self.renderFlow();
					});
				});
			}

			// This need to be evaluated before the children start adding content
			children = $('.children', flow);

			$.each(branch.children, function() {
				children.append(self._renderBranch(this));
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

						self._enableDestinations($(this));

						action(clone);
						clone.addClass('inactive');
						clone.insertBefore($(this));

						$(this).addClass('active');
					},
					drag: function () {
						$('.callflow_helpbox_wrapper', '#callflow-view').hide();
					},
					stop: function () {
						self._disableDestinations();
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

		_enableDestinations: function(el) {
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

		_disableDestinations: function() {
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

		// Defining actions
		define_callflow_nodes: function(args) {
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
