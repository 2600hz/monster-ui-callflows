define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.blacklist.edit': 'blacklistEdit',
			'callflows.fetchActions': 'blacklistDefineActions',
		},

		blacklistDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			$.extend(callflow_nodes, {
				'blacklist': {
					name: self.i18n.active().callflows.blacklist.title,
					module: 'blacklist',
					listEntities: function(callback) {
						self.callApi({
							resource: 'blacklist.list',
							data: {
								accountId: self.accountId,
								filters: { paginate:false }
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.blacklist.edit'
				}
			});
		},

		// Added for the subscribed event to avoid refactoring conferenceEdit
		blacklistEdit: function(args) {
			var self = this,
				afterGetData = function(data) {
					var template = $(monster.template(self, 'blacklist-edit', {data: data})),
						blacklistForm = template.find('#blacklist-form'),
						$listNumbers = template.find('.saved-numbers');

					monster.ui.validate(blacklistForm, {
						rules: {
							'name': { required: true },
						}
					});

					_.each(data.numbers, function(v, number) {
						$listNumbers.append(monster.template(self, 'blacklist-addNumber', {number: number}));
					});

					self.blacklistBindEvents(data, template, args.callbacks);

					(args.target)
						.empty()
						.append(template);
				};

			if(args.data.id) {
				self.blacklistGet(args.data.id, function(data) {
					afterGetData(data);
				});
			}
			else {
				afterGetData({});
			}
		},

		blacklistBindEvents: function(data, template, callbacks) {
			var self = this,
				addNumber = function(e) {
					var number = template.find('#number_value').val();

					if(number) {
						$('.list-numbers .saved-numbers', template).prepend(monster.template(self,'blacklist-addNumber', { number: number }));

						$('#number_value', template).val('');
					}
				};

			$('.number-wrapper.placeholder:not(.active)', template).click(function() {
				var $this = $(this);

				$this.addClass('active');

				$('#number_value', template).focus();
			});

			$('#add_number', template).click(function() {
				addNumber();
			});

			$('.add-number', template).bind('keypress', function(e) {
				var code = e.keyCode || e.which;

				if(code === 13) {;
					addNumber(e);
				}
			});

			$(template).delegate('.delete-number', 'click', function(e) {
				$(this).parents('.number-wrapper').remove();
			});

			$('#cancel_number', template).click(function(e) {
				e.stopPropagation();

				$('.number-wrapper.placeholder.active', template).removeClass('active');
				$('#number_value', template).val('');
			});

			$('.blacklist-save', template).click(function() {
				var formData = form2object('blacklist-form'),
					cleanData = self.blacklistCleanFormData(formData),
					mapNumbers = {};

				$('.saved-numbers .number-wrapper', template).each(function(k, wrapper) {
					var number = $(wrapper).attr('data-number');
					mapNumbers[number] = {};
				});

				cleanData.numbers = mapNumbers;

				if(data.id) {
					cleanData.id = data.id;
				}

				self.blacklistSave(cleanData, callbacks.save_success);
			});

			$('.blacklist-delete', template).click(function() {
				monster.ui.confirm(self.i18n.active().callflows.blacklist.are_you_sure_you_want_to_delete, function() {
					self.blacklistDelete(data.id, callbacks.delete_success);
				});
			});
		},

		blacklistCleanFormData: function(data) {
			delete data.extra;

			return data;
		},

		blacklistSave: function(data, callback) {
			var self = this;

			if(data.id) {
				self.blacklistUpdate(data, callback);
			}
			else {
				self.blacklistCreate(data, callback);
			}
		},

		blacklistList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.list',
				data: {
					accountId: self.accountId,
					filters: { paginate:false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistGet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.get',
				data: {
					accountId: self.accountId,
					blacklistId: id
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.update',
				data: {
					accountId: self.accountId,
					blacklistId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistDelete: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.delete',
				data: {
					accountId: self.accountId,
					blacklistId: id
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
