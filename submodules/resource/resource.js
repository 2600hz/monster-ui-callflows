define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'resourceDefineActions'
		},

		resourceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'offnet[]': {
					name: self.i18n.active().resource.global_carrier,
					icon: 'offnet',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'offnet',
					tip: self.i18n.active().resource.global_carrier_tip,
					data: {},
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
						if(typeof callback == 'function') {
							callback();
						}
					}
				},
				'resources[]': {
					name: self.i18n.active().resource.account_carrier,
					icon: 'resource',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'resources',
					tip: self.i18n.active().resource.account_carrier_tip,
					data: {},
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
						var popup, popup_html;

						popup_html = self.templates.account_carrier_callflow.tmpl({
							_t: function(param){
								return window.translate['resource'][param];
							},
							data_resource: {
								'hunt_account_id': node.getMetadata('hunt_account_id') || '',
							}
						});

						$('#add', popup_html).click(function() {
							var hunt_id = $('#hunt_account_id', popup_html).val();

							if(hunt_id) {
								node.setMetadata('hunt_account_id', hunt_id);
							}

							popup.dialog('close');
						});

						popup = winkstart.dialog(popup_html, {
							title: self.i18n.active().resource.account_carrier_title,
							minHeight: '0',
							beforeClose: function() {
								if(typeof callback == 'function') {
									 callback();
								}
							}
						});
					}
				}
			});
		}
	};

	return app;
});
