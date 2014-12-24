define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'menuDefineActions'
		},

		menuList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'menu.list',
				data: {
					accountId: self.accountId
				},
				success: callback
			});
		},

		menuDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'menu[id=*]': {
					name: self.i18n.active().callflows.menu.menu_title,
					icon: 'menu1',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'menu',
					tip: self.i18n.active().callflows.menu.menu_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '12'
						}
					],
					isUsable: 'true',
					key_caption: function(child_node, caption_map) {
						var key = child_node.key;

						return (key != '_') ? key : self.i18n.active().callflows.menu.default_action;
					},
					key_edit: function(child_node, callback) {
						var popup, popup_html;

						/* The '#' Key is not available anymore but we let it here so that it doesn't break existing callflows.
						   The '#' Key is only displayed if it exists in the callflow, otherwise it is hidden by the template (see /tmpl/menu_key_callflow.html)
						*/

						popup_html = $(monster.template(self, 'menu-callflowKey', {
							items: {
								'_': self.i18n.active().callflows.menu.default_action,
								'0': '0',
								'1': '1',
								'2': '2',
								'3': '3',
								'4': '4',
								'5': '5',
								'6': '6',
								'7': '7',
								'8': '8',
								'9': '9',
								'*': '*',
								'#': '#'
							},
							selected: child_node.key
						}));

						popup_html.find('#add').on('click', function() {
							console.log('click');
							child_node.key = $('#menu_key_selector', popup).val();

							child_node.key_caption = $('#menu_key_selector option:selected', popup).text();

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.menu.menu_option_title,
							minHeight: '0',
							beforeClose: function() {
								callback && callback();
							}
						});
					},
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

						self.menuList(function(data) {
							var popup, popup_html;

							popup_html = $(monster.template(self, 'menu-callflowEdit', {
								items: monster.util.sort(data.data),
								selected: node.getMetadata('id') || ''
							}));

							if($('#menu_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).dataset('action') == 'edit') ?
												{ id: $('#menu_selector', popup_html).val() } : {};

								ev.preventDefault();

								winkstart.publish('menu.popup_edit', _data, function(_data) {
									node.setMetadata('id', _data.data.id || 'null');

									node.caption = _data.data.name || '';

									popup.dialog('close');
								});
							});

							console.log(popup_html);
							console.log(popup_html.find('#add'));

							popup_html.find('#add').on('click', function() {
								console.log('click');
								node.setMetadata('id', $('#menu_selector', popup).val());
								node.caption = $('#menu_selector option:selected', popup).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.menu.menu_title,
								minHeight: '0',
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
