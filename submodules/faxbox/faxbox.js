define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'faxboxDefineActions'
		},

		faxboxDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'faxbox[id=*]': {
					name: self.i18n.active().callflows.faxbox.faxboxes_label,
					icon: 'printer2',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'faxbox',
					tip: self.i18n.active().callflows.faxbox.faxbox_tip,
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
						var id = node.getMetadata('id'),
							returned_value = '';

						if(id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this;

						self.faxboxList(function(data, status) {
							var popup_html = $(monster.template(self, 'faxbox-callflowEdit', {
									items: monster.util.sort(data),
									selected: node.getMetadata('id') || ''
								})),
								popup;

							if($('#faxbox_selector option:selected', popup_html).val() == undefined) {
								$('#edit_link', popup_html).hide();
							}

							$('.inline_action', popup_html).click(function(ev) {
								var _data = ($(this).data('action') == 'edit') ?
												{ id: $('#faxbox_selector', popup_html).val() } : {};

								ev.preventDefault();

								self.faxboxPopupEdit(_data, function(_data) {
									node.setMetadata('id', _data.id || 'null');

									node.caption = _data.name || '';

									popup.dialog('close');
								});
							});

							$('#add', popup_html).click(function() {
								node.setMetadata('id', $('#faxbox_selector', popup_html).val());

								node.caption = $('#faxbox_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.faxbox.voicemail_title,
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
		},

		faxboxPopupEdit: function(data, callback, data_defaults) {
			var self = this,
				popup_html = popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				popup;

			self.faxboxEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if ( typeof callback == 'function' ) {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if ( typeof callback == 'function' ) {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = winkstart.dialog(popup_html, {
						title: self.i18n.active().callflows.faxbox[(data.id ? 'edit' : 'create').concat('_faxbox')]
					});
				}
			}, data_defaults);
		},

		faxboxEdit: function(data, _parent, _target, _callbacks) {
		},





		faxboxList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxGet: function(faxboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.get',
				data: {
					accountId: self.accountId,
					faxboxId: faxboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.update',
				data: {
					accountId: self.accountId,
					faxboxId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxboxDelete: function(faxboxId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'faxbox.delete',
				data: {
					accountId: self.accountId,
					faxboxId: faxboxId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(error) {
					callbackError && callbackError();
				}
			});
		},
	};

	return app;
});
