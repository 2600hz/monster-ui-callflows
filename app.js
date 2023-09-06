define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var appSubmodules = [
		'blacklist',
		'branchvariable',
		'conference',
		'device',
		'directory',
		'faxbox',
		'featurecodes',
		'groups',
		'media',
		'menu',
		'misc',
		'qubicle',
		'resource',
		'temporalset',
		'timeofday',
		'user',
		'vmbox'
	];

	require(_.map(appSubmodules, function(name) {
		return './submodules/' + name + '/' + name;
	}));

	var app = {
		name: 'callflows',

		css: [ 'app', 'icons' ],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false }
		},

		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps
		subscribe: {},

		subModules: appSubmodules,

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
		load: function(callback) {
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
		render: function(container) {
			var self = this,
				parent = _.isEmpty(container) ? $('#monster_content') : container;

			monster.pub('callflows.fetchActions', { actions: self.actions });

			self.renderEntityManager(parent);
		},

		renderCallflows: function(container) {
			var self = this,
				callflowsTemplate = $(self.getTemplate({
					name: 'callflow-manager',
					data: {
						canToggleCallflows: (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin,
						hasAllCallflows: self.appFlags.showAllCallflows
					}
				}));

			self.bindCallflowsEvents(callflowsTemplate, container);

			monster.ui.tooltips(callflowsTemplate);

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

		bindCallflowsEvents: function(template, container) {
			var self = this,
				callflowList = template.find('.list-container .list'),
				isLoading = false,
				loader = $('<li class="content-centered list-loader"> <i class="fa fa-spinner fa-spin"></i></li>'),
				searchLink = $(self.getTemplate({
					name: 'callflowList-searchLink'
				}));

			template.find('.superadmin-mode #switch_role').on('change', function(e) {
				self.appFlags.showAllCallflows = $(this).is(':checked');

				self.renderCallflows(container);
			});

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
				if (!isLoading && callflowList.data('next-key') && (callflowList.scrollTop() >= (callflowList[0].scrollHeight - callflowList.innerHeight() - 100))) {
					isLoading = true;
					callflowList.append(loader);

					self.listData({
						callback: function(callflowData) {
							var listCallflows = $(self.getTemplate({
								name: 'callflowList',
								data: {
									callflows: callflowData.data
								}
							}));

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
				if (search) {
					$.each(template.find('.list-element'), function() {
						var $elem = $(this);
						if ($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
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
				if (searchLink.hasClass('active')) {
					callflowList.data('search-value', null);
					searchLink
						.removeClass('active')
						.remove();
					template
						.find('.search-query')
						.prop('disabled', false)
						.val('');
					self.repaintList({ template: template });
				} else {
					var searchValue = searchLink.find('.search-value').text();
					searchLink
						.addClass('active')
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
				entityActions = _
					.chain(self.actions)
					.filter('listEntities')
					.keyBy('module')
					.value(),
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						actions: _
							.chain(entityActions)
							.map()
							.sortBy('name')
							.value()
					}
				}));

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
				if ($this.hasClass('callflow-element')) {
					self.renderCallflows(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else if ($this.hasClass('account-element')) {
					self.renderAccountSettings(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else if ($this.hasClass('feature-code-element')) {
					monster.pub('callflows.featurecode.render', template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else {
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
				if (search) {
					$.each(template.find('.entity-edition .list-element'), function() {
						var $elem = $(this);
						if ($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
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
				getLowerCasedDisplayName = _.flow(
					_.partial(_.get, _, 'displayName'),
					_.toLower
				),
				template = args.template,
				actions = args.actions,
				entityType = args.entityType,
				callback = args.callbacks,
				formatEntityData = _.bind(self.formatEntityData, self, _, entityType);

			actions[entityType].listEntities(function(entities) {
				var listEntities = $(self.getTemplate({
					name: 'entity-list',
					data: {
						entities: _
							.chain(entities)
							.thru(formatEntityData)
							.sortBy(getLowerCasedDisplayName)
							.value()
					}
				}));

				monster.ui.tooltips(listEntities);

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
			var self = this,
				isStringAndNotEmpty = _.overEvery(
					_.isString,
					_.negate(_.isEmpty)
				),
				getFullName = function(entity) {
					var values = _.map([
							'first_name',
							'last_name'
						], _.partial(_.ary(_.get, 2), entity)),
						hasInvalidValue = _.some(values, _.negate(isStringAndNotEmpty));

					return hasInvalidValue ? undefined : _.join(values, ' ');
				},
				getDisplayName = function(entity) {
					return _
						.chain([
							getFullName(entity),
							_.map([
								'name',
								'id'
							], _.partial(_.ary(_.get, 2), entity))
						])
						.flatten()
						.find(isStringAndNotEmpty)
						.value();
				},
				isMediaSource = function(entity) {
					return entityType === 'play' && entity.media_source;
				};

			return _.map(entities, function(entity) {
				return _.merge({
					displayName: getDisplayName(entity)
				}, isMediaSource(entity) && {
					additionalInfo: self.i18n.active().callflows.media.mediaSources[entity.media_source]
				}, entity);
			});
		},

		renderAccountSettings: function(container) {
			var self = this;

			self.loadAccountSettingsData(function(accountSettingsData) {
				var formattedData = self.formatAccountSettingsData(accountSettingsData),
					template = $(self.getTemplate({
						name: 'accountSettings',
						data: formattedData
					})),
					widgetBlacklist = self.renderBlacklists(template, accountSettingsData);

				_.forEach(monster.util.getCapability('caller_id.external_numbers').isEnabled ? [
					'external',
					'emergency',
					'asserted'
				] : [], function(type) {
					var $target = template.find('.caller-id-' + type + '-target');

					if (!$target.length) {
						return;
					}
					monster.ui.cidNumberSelector($target, {
						noneLabel: self.i18n.active().callflows.accountSettings.callerId.defaultNumber,
						selectName: 'caller_id.' + type + '.number',
						selected: _.get(formattedData.account, ['caller_id', type, 'number']),
						cidNumbers: formattedData.externalNumbers,
						phoneNumbers: _.map(formattedData.numberList, function(number) {
							return {
								number: number
							};
						})
					});
				});

				monster.ui.tooltips(template);

				// Setup input fields
				monster.ui.chosen(template.find('.cid-number-select, .preflow-callflows-dropdown'));
				monster.ui.mask(template.find('.phone-number'), 'phoneNumber');

				// Set validation rules
				monster.ui.validate(template.find('#account_settings_form'), {
					rules: {
						'caller_id.asserted.number': {
							phoneNumber: true
						},
						'caller_id.asserted.realm': {
							realm: true
						}
					},
					messages: {
						'caller_id.asserted.number': self.i18n.active().callflows.accountSettings.callerId.messages.invalidNumber
					}
				});

				container.empty().append(template);

				self.bindAccountSettingsEvents(template, accountSettingsData, widgetBlacklist);
			});
		},

		formatAccountSettingsData: function(data) {
			var silenceMedia = 'silence_stream://300000',
				isShoutcast = _
					.chain(data.account)
					.get('music_on_hold.media_id')
					.thru(_.overEvery(
						_.partial(_.includes, _, '://'),
						_.partial(_.negate(_.isEqual), silenceMedia)
					))
					.value(),
				preflowCallflows = _
					.chain(data.callflows)
					.filter(_.overEvery(
						{ featurecode: false },
						_.flow(
							_.partial(_.get, _, 'numbers'),
							_.partial(_.negate(_.includes), _, 'no_match')
						)
					))
					.map(function(callflow) {
						return _.merge({
							friendlyName: _.get(callflow, 'name', _.toString(callflow.numbers))
						}, _.pick(callflow, [
							'id'
						]));
					})
					.sortBy(_.flow(
						_.partial(_.get, _, 'friendlyName'),
						_.toLower
					))
					.value();

			return _.merge({
				hasExternalCallerId: monster.util.getCapability('caller_id.external_numbers').isEnabled,
				numberList: _.keys(data.numberList),
				extra: {
					isShoutcast: isShoutcast,
					preflowCallflows: preflowCallflows
				},
				outbound_flags: _
					.chain(data.outbound_flags)
					.pick([
						'dynamic',
						'static'
					])
					.mapValues(
						_.partial(_.ary(_.join, 2), _, ',')
					)
					.value(),
				silenceMedia: silenceMedia
			}, _.pick(monster.config.whitelabel, [
				'showMediaUploadDisclosure',
				'showPAssertedIdentity'
			]), _.omit(data, [
				'numberList',
				'callflows'
			]));
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
					if (newMedia) {
						var mediaSelect = template.find('.media-dropdown');
						mediaSelect.append('<option value="' + newMedia.id + '">' + newMedia.name + '</option>');
						mediaSelect.val(newMedia.id);
					}
				};

			template.find('.account-settings-tabs a').click(function(e) {
				e.preventDefault();

				$(this).tab('show');
			});

			template.find('.media-dropdown').on('change', function() {
				template.find('.shoutcast-div').toggleClass('active', $(this).val() === 'shoutcast').find('input').val('');
			});

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
					if (errors.hasOwnProperty('size') && errors.size.length > 0) {
						monster.ui.alert(self.i18n.active().callflows.accountSettings.musicOnHold.fileTooBigAlert);
					}
					template.find('.upload-div input').val('');
					mediaToUpload = undefined;
				}
			});

			template.find('.upload-toggle').on('click', function() {
				if ($(this).hasClass('active')) {
					template.find('.upload-div').stop(true, true).slideUp();
				} else {
					template.find('.upload-div').stop(true, true).slideDown();
				}
			});

			template.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			template.find('.upload-submit').on('click', function() {
				template.find('.shoutcast-div').removeClass('active');
				if (mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: 'upload',
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
				// Validate form
				if (!monster.ui.valid(template.find('#account_settings_form'))) {
					return;
				}

				// Collect data
				var formData = monster.ui.getFormData('account_settings_form'),
					newData = _.merge({}, data.account, formData);

				// Format data
				if (_.has(newData.caller_id, 'asserted')) {
					newData.caller_id.asserted.number = monster.util.getFormatPhoneNumber(newData.caller_id.asserted.number).e164Number;
				}

				// Clean empty data
				if (formData.music_on_hold.media_id === '') {
					delete newData.music_on_hold.media_id;
				} else if (formData.music_on_hold.media_id === 'shoutcast') {
					newData.music_on_hold.media_id = template.find('.shoutcast-url-input').val();
				}

				self.compactObject(newData.caller_id);

				if (_.isEmpty(newData.caller_id)) {
					delete newData.caller_id;
				}

				if (formData.preflow.always === '_disabled') {
					delete newData.preflow.always;
				}

				if (newData.hasOwnProperty('outbound_flags')) {
					newData.outbound_flags.dynamic = newData.outbound_flags.dynamic ? newData.outbound_flags.dynamic.split(',') : [];
					newData.outbound_flags.static = newData.outbound_flags.static ? newData.outbound_flags.static.split(',') : [];
					_.isEmpty(newData.outbound_flags.dynamic) && delete newData.outbound_flags.dynamic;
					_.isEmpty(newData.outbound_flags.static) && delete newData.outbound_flags.static;
					_.isEmpty(newData.outbound_flags) && delete newData.outbound_flags;
				}

				newData.blacklists = widgetBlacklist.getSelectedItems();

				delete newData.extra;

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
			monster.parallel(_.merge({
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
				callflows: function(parallelCallback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
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
							accountId: self.accountId,
							filters: {
								paginate: false
							}
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
							accountId: self.accountId,
							filters: {
								paginate: false
							}
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
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				}
			}, monster.util.getCapability('caller_id.external_numbers').isEnabled && {
				externalNumbers: function(next) {
					self.callApi({
						resource: 'externalNumbers.list',
						data: {
							accountId: self.accountId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(next, null)
						),
						error: _.partial(_.ary(next, 2), null, [])
					});
				}
			}), function(err, results) {
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
					contentHeight = window.innerHeight - $('.core-topbar-wrapper').outerHeight(),
					contentHeightPx = contentHeight + 'px',
					innerContentHeightPx = (contentHeight - 71) + 'px';

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
					var listCallflows = $(self.getTemplate({
						name: 'callflowList',
						data: { callflows: callflowData.data }
					}));

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
				apiResource = searchValue ? 'callflow.searchByNameAndNumber' : 'callflow.list',
				apiData = _.merge({
					accountId: self.accountId
				}, nextStartKey && {
					filters: {
						start_key: nextStartKey
					}
				}, !self.appFlags.showAllCallflows && {
					filters: {
						filter_not_numbers: 'no_match',
						'filter_not_ui_metadata.origin': [
							'voip',
							'callqueues',
							'callqueues-pro',
							'csv-onboarding'
						]
					}
				}, searchValue && {
					value: searchValue
				});

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
					accountId: self.accountId,
					filters: {
						paginate: false
					}
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
				if (!numberData.hasOwnProperty('used_by') || numberData.used_by === '') {
					numberData.phoneNumber = phoneNumber;
					listSpareNumbers.push(numberData);
				}
			});

			return listSpareNumbers;
		},

		formatData: function(data) {
			var formattedList = [];

			_.each(data.data, function(callflow) {
				var formattedNumbers = _.map(callflow.numbers || '-', function(number) {
						return _.startsWith('+', number)
							? monster.util.formatPhoneNumber(number)
							: number;
					}),
					listNumbers = formattedNumbers.toString(),
					isFeatureCode = callflow.featurecode !== false && !_.isEmpty(callflow.featurecode);

				if (!isFeatureCode) {
					if (callflow.name) {
						callflow.description = listNumbers;
						callflow.title = callflow.name;
					} else {
						callflow.title = listNumbers;
					}

					formattedList.push(callflow);
				}
			});

			formattedList.sort(function(a, b) {
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

			if (data && data.id) {
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

						if (callflow.flow.module !== undefined) {
							self.flow.root = self.buildFlow(callflow.flow, self.flow.root, 0, '_');
						}

						self.flow.numbers = callflow.numbers || [];

						self.repaintFlow();
					}
				});
			} else {
				self.resetFlow();
				self.dataCallflow = {};
				self.repaintFlow();
			}

			self.renderButtons();
			self.renderTools();
		},

		renderButtons: function() {
			var self = this,
				buttons = $(self.getTemplate({
					name: 'buttons'
				}));

			$('.buttons').empty();

			$('.save', buttons).click(function() {
				if (self.flow.numbers && self.flow.numbers.length > 0) {
					self.save();
				} else {
					monster.ui.alert(self.i18n.active().oldCallflows.invalid_number + '<br/><br/>' + self.i18n.active().oldCallflows.please_select_valid_number);
				}
			});

			$('.delete', buttons).click(function() {
				if (self.flow.id) {
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
								$('#hidden_callflow_warning').hide();

								self.repaintList();
								self.resetFlow();
							}
						});

						self.show_pending_change(false);
					});
				} else {
					monster.ui.alert(self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
				}
			});

			$('.buttons').append(buttons);
		},

		// Callflow JS code
		buildFlow: function(json, parent, id, key) {
			var self = this,
				branch = self.branch(self.construct_action(json));

			branch.data.data = _.get(json, 'data', {});
			branch.id = ++id;
			branch.key = key;
			branch.disabled = _.get(json, 'data.skip_module');

			branch.caption = self.actions.hasOwnProperty(branch.actionName) ? self.actions[branch.actionName].caption(branch, self.flow.caption_map) : '';

			if (self.actions.hasOwnProperty(parent.actionName) && self.actions[parent.actionName].hasOwnProperty('key_caption')) {
				branch.key_caption = self.actions[parent.actionName].key_caption(branch, self.flow.caption_map);
			}

			if (json.hasOwnProperty('children')) {
				$.each(json.children, function(key, child) {
					branch = self.buildFlow(child, branch, id, key);
				});
			}

			parent.addChild(branch);

			return parent;
		},

		construct_action: function(json) {
			var self = this,
				actionParams = '';

			if ('data' in json) {
				if ('id' in json.data) {
					actionParams = 'id=*,';
				}

				if ('action' in json.data) {
					actionParams += 'action=' + json.data.action + ',';
				}
			}

			if (actionParams !== '') {
				actionParams = '[' + actionParams.replace(/,$/, ']');
			} else {
				actionParams = '[]';
			}

			return _.has(self.actions, json.module + actionParams)
				? json.module + actionParams
				: json.module + '[]';
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

			function Branch(actionName) {
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

					for (var i in self.actions) {
						if (self.actions[i].isUsable) {
							list[i] = i;
						}
					}

					for (var i in action.rules) {
						var rule = action.rules[i];

						if (rule.type === 'quantity' && this.children.length >= rule.maxSize) {
							list = [];
						}
					}

					return list;
				};

				this.contains = function(branch) {
					var toCheck = branch;

					while (toCheck.parent) {
						if (this.id === toCheck.id) {
							return true;
						} else {
							toCheck = toCheck.parent;
						}
					}

					return false;
				};

				this.removeChild = function(branch) {
					$.each(this.children, function(i, child) {
						if (child.id === branch.id) {
							that.children.splice(i, 1);
							return false;
						}
					});
				};

				this.addChild = function(branch) {
					if (!(branch.actionName in this.potentialChildren())) {
						return false;
					}

					if (branch.contains(this)) {
						return false;
					}

					if (branch.parent) {
						branch.parent.removeChild(branch);
					}

					branch.parent = this;

					this.children.push(branch);

					return true;
				};

				this.getMetadata = function(key, defaultValue) {
					var value;

					if (_.has(this.data, ['data', key])) {
						value = this.data.data[key];

						return (value === 'null') ? null : value;
					}

					return _.isUndefined(defaultValue) ? false : defaultValue;
				};

				this.setMetadata = function(key, value) {
					if (!('data' in this.data)) {
						this.data.data = {};
					}

					this.data.data[key] = (value == null) ? 'null' : value;
				};

				this.deleteMetadata = function(key) {
					if ('data' in this.data && key in this.data.data) {
						delete this.data.data[key];
					}
				};

				this.index = function(index) {
					this.id = index;

					$.each(this.children, function() {
						index = this.index(index + 1);
					});

					return index;
				};

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
				};

				this.serialize = function() {
					var json = $.extend(true, {}, this.data);

					json.module = this.module;

					json.children = {};

					$.each(this.children, function() {
						json.children[this.key] = this.serialize();
					});

					return json;
				};
			}

			return new Branch(actionName);
		},

		repaintFlow: function() {
			var self = this;

			// Let it there for now, if we need to save callflows automatically again.
			/*if ('savable' in THIS.flow) {
				THIS.save_callflow_no_loading();
			}*/

			self.flow.savable = true;

			var target = $('#ws_cf_flow').empty();

			target.append(this.getUIFlow());

			var current_flow = self.stringify_flow(self.flow);

			if (!('original_flow' in self) || self.original_flow.split('|')[0] !== current_flow.split('|')[0]) {
				self.original_flow = current_flow;
				self.show_pending_change(false);
			} else {
				self.show_pending_change(self.original_flow !== current_flow);
			}

			var metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.includes(['voip', 'migration', 'mobile', 'callqueues'], metadata.origin);

			isHiddenCallflow ? $('#hidden_callflow_warning').show() : $('#hidden_callflow_warning').hide();
		},

		show_pending_change: function(pending_change) {
			var self = this;
			if (pending_change) {
				$('#pending_change', '#ws_callflow').show();
				$('.save', '#ws_callflow').addClass('pulse-box');
			} else {
				$('#pending_change', '#ws_callflow').hide();
				$('.save', '#ws_callflow').removeClass('pulse-box');
			}
		},

		// We add this function because today the stringify flow doesn't handle arrays well
		// For instance in ring groups, if we change the timeout of a member, it won't toggle the "pending changes" warning
		stringify_obj: function(obj) {
			var self = this,
				str = '[';

			_.each(obj, function(v, k) {
				// Had to add this check since when we list objects with sortable, we usually just add items with .data(), but it includes sortableItem from the jQuery plugin for a short time.
				// If we don't avoid it, then we run into a JS Exception
				if (k !== 'sortableItem') {
					if (typeof v === 'object') {
						str += k + ':' + self.stringify_obj(v);
					} else if (['boolean', 'string', 'number'].indexOf(typeof v) >= 0) {
						str += k + ':' + v;
					}

					str += '|';
				}
			});

			str += ']';

			return str;
		},

		stringify_flow: function(flow) {
			var self = this,
				s_flow = flow.id + '|' + (!flow.name ? 'undefined' : flow.name),
				first_iteration;
			s_flow += '|NUMBERS';
			$.each(flow.numbers, function(key, value) {
				s_flow += '|' + value;
			});
			s_flow += '|NODES';
			$.each(flow.nodes, function(key, value) {
				s_flow += '|' + key + '::';
				first_iteration = true;

				$.each(value.data.data, function(k, v) {
					if (!first_iteration) {
						s_flow += '//';
					} else {
						first_iteration = false;
					}

					if (typeof v !== 'object') {
						s_flow += k + ':' + v;
					} else {
						s_flow += k + ':' + self.stringify_obj(v);
					}
				});
			});

			return s_flow;
		},

		getCallflowPreview: function(data, callback) {
			var self = this,
				layout;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: data.id
				},
				success: function(callflow) {
					var callflow = callflow.data,
						flow = {};

					flow.root = self.branch('root');
					flow.root.key = 'flow';
					flow.numbers = [];
					flow.caption_map = {};
					flow.root.index(0);
					flow.nodes = flow.root.nodes();

					flow.id = callflow.id;
					flow.name = callflow.name;
					flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
					flow.caption_map = callflow.metadata;

					if (callflow.flow.module !== undefined) {
						flow.root = self.buildFlow(callflow.flow, flow.root, 0, '_');
					}

					flow.nodes = flow.root.nodes();
					flow.numbers = callflow.numbers || [];

					//prepare html from callflow

					layout = self.renderBranch(flow.root);
					callback && callback(layout);

					$('.node', layout).each(function() {
						var node = flow.nodes[$(this).attr('id')],
							$node = $(this),
							node_html;

						if (node.actionName === 'root') {
							$node.removeClass('icons_black root');
							node_html = $(self.getTemplate({
								name: 'root',
								data: {
									name: flow.name || 'Callflow'
								}
							}));

							for (var counter, size = flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
								counter = i * 2;

								var numbers = flow.numbers.slice(counter, (counter + 2 < size) ? counter + 2 : size),
									row = $(self.getTemplate({
										name: 'rowNumber',
										data: {
											numbers: numbers
										}
									}));

								node_html
									.find('.content')
									.append(row);
							}
						} else {
							node_html = $(self.getTemplate({
								name: 'node',
								data: {
									node: node,
									callflow: self.actions[node.actionName]
								}
							}));
						}
						$(this).append(node_html);
					});
				}
			});
		},

		getUIFlow: function() {
			var self = this;

			self.formatFlow();

			var layout = self.renderBranch(self.flow.root);

			$('.node', layout).hover(function() {
				$(this).addClass('over');
			}, function() {
				$(this).removeClass('over');
			});

			$('.node', layout).each(function() {
				var node = self.flow.nodes[$(this).attr('id')],
					$node = $(this),
					node_html;

				if (node.actionName === 'root') {
					$node.removeClass('icons_black root');
					node_html = $(self.getTemplate({
						name: 'root',
						data: {
							name: self.flow.name || 'Callflow'
						}
					}));

					$('.edit_icon', node_html).click(function() {
						self.flow = $.extend(true, { contact_list: { exclude: false } }, self.flow);

						var dialogTemplate = $(self.getTemplate({
								name: 'editName',
								data: {
									name: self.flow.name,
									exclude: self.flow.contact_list.exclude,
									ui_is_main_number_cf: self.dataCallflow.hasOwnProperty('ui_is_main_number_cf') ? self.dataCallflow.ui_is_main_number_cf : false
								}
							})),
							popup = monster.ui.dialog(dialogTemplate, {
								title: self.i18n.active().oldCallflows.popup_title
							});

						$('#add', popup).click(function() {
							var $callflow_name = $('#callflow_name', popup);
							if ($callflow_name.val() !== '') {
								self.flow.name = $callflow_name.val();
								$('.root .top_bar .name', layout).html(self.flow.name);
							} else {
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

					for (var counter, size = self.flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
						counter = i * 2;

						var numbers = self.flow.numbers.slice(counter, (counter + 2 < size) ? counter + 2 : size),
							row = $(self.getTemplate({
								name: 'rowNumber',
								data: {
									numbers: _.map(numbers, function(number) {
										return _.startsWith('+', number)
											? monster.util.formatPhoneNumber(number)
											: number;
									})
								}
							}));

						node_html
							.find('.content')
							.append(row);
					}

					$('.number_column.empty', node_html).click(function() {
						self.listNumbers(function(phoneNumbers) {
							var parsedNumbers = [];

							_.each(phoneNumbers, function(number) {
								if ($.inArray(number.phoneNumber, self.flow.numbers) < 0) {
									parsedNumbers.push(number);
								}
							});

							var popup_html = $(self.getTemplate({
									name: 'addNumber',
									data: {
										phoneNumbers: parsedNumbers,
										hideBuyNumbers: _.get(monster, 'config.whitelabel.hideBuyNumbers', false)
									}
								})),
								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.add_number
								});

							monster.ui.chosen(popup_html.find('#list_numbers'), {
								width: '160px'
							});
							// Have to do that so that the chosen dropdown isn't hidden.
							popup_html.parent().css('overflow', 'visible');

							if (parsedNumbers.length === 0) {
								$('#list_numbers', popup_html).attr('disabled', 'disabled');
								$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup_html));
							}

							var refresh_numbers = function() {
								self.listNumbers(function(refreshedNumbers) {
									$('#list_numbers', popup).empty();

									if (refreshedNumbers.length === 0) {
										$('#list_numbers', popup).attr('disabled', 'disabled');
										$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup));
									} else {
										$('#list_numbers', popup).removeAttr('disabled');
										$.each(refreshedNumbers, function(k, v) {
											$('<option value="' + v + '">' + v + '</option>').appendTo($('#list_numbers', popup));
										});
									}
								});
							};

							$('.extensions_content', popup).hide();

							$('input[name="number_type"]', popup).click(function() {
								if ($(this).val() === 'your_numbers') {
									$('.list_numbers_content', popup).show();
									$('.extensions_content', popup).hide();
								} else {
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
											var lastNumber;

											_.each(numbers, function(number, k) {
												popup.find('#list_numbers').append($('<option value="' + k + '">' + monster.util.formatPhoneNumber(k) + '</option>'));
												lastNumber = k;
											});

											popup.find('#list_numbers').val(lastNumber).trigger('chosen:updated');
										}
									}
								});
							});

							popup.find('.search-extension-link').on('click', function() {
								monster.pub('common.extensionTools.select', {
									callback: function(number) {
										popup.find('#add_number_text').val(number);
									}
								});
							});

							$('.add_number', popup).click(function(event) {
								event.preventDefault();
								var number = $('input[name="number_type"]:checked', popup).val() === 'your_numbers' ? $('#list_numbers option:selected', popup).val() : $('#add_number_text', popup).val();

								if (number !== 'select_none' && number !== '') {
									self.flow.numbers.push(number);
									popup.dialog('close');

									self.repaintFlow();
								} else {
									monster.ui.alert(self.i18n.active().oldCallflows.you_didnt_select);
								}
							});
						});
					});

					$('.number_column .delete', node_html).click(function() {
						var number = $(this).parent('.number_column').data('number') + '',
							index = $.inArray(number, self.flow.numbers);

						if (index >= 0) {
							self.flow.numbers.splice(index, 1);
						}

						self.repaintFlow();
					});
				} else {
					node_html = $(self.getTemplate({
						name: 'node',
						data: {
							node: node,
							callflow: self.actions[node.actionName]
						}
					}));

					// If an API request takes some time, the user can try to re-click on the element, we do not want to let that re-fire a request to the back-end.
					// So we set a 500ms debounce wait that will prevent any other interaction with the callflow element.
					node_html.find('.module').on('click', _.debounce(function() {
						monster.waterfall([
							function(waterfallCallback) {
								if (node.disabled) {
									monster.ui.confirm(self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.text,
										function() {
											waterfallCallback(null, false);
										},
										function() {
											waterfallCallback(null, true);
										}, {
											cancelButtonText: self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.cancel,
											confirmButtonText: self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.ok
										});
								} else {
									waterfallCallback(null, null);
								}
							}
						], function(err, disabled) {
							if (!_.isNull(disabled)) {
								node.disabled = disabled;
								if (_.has(node, 'data.data.skip_module')) {
									node.data.data.skip_module = disabled;
								}

								if (!disabled) {
									node_html.closest('.node').removeClass('disabled');
								}
							}

							self.actions[node.actionName].edit(node, function() {
								self.repaintFlow();
							});
						});
					}, 500, {
						leading: true,
						trailing: false
					}));
				}

				//make names of callflow nodes clickable
				$('.details a', node_html).click(function(event) {
					event.stopPropagation();
					var previewCallflowId = self.flow.nodes[$(node_html).find('.delete').attr('id')].data.data.id,
						dialogTemplate = $(self.getTemplate({
							name: 'callflows-callflowElementDetails',
							data: {
								id: previewCallflowId
							}
						})),
						popup;
					self.getCallflowPreview({ id: previewCallflowId }, function(callflowPreview) {
						popup = monster.ui.dialog(dialogTemplate, {
							position: ['top', 20], // put preview near top of screen to have lots of space for it
							title: self.i18n.active().oldCallflows.callflow_preview_title,
							width: '650px'
						});
						popup.find('.callflow-preview-section.callflow').append(callflowPreview);
						$('#callflow_jump').click(function() {
							self.editCallflow({ id: previewCallflowId });
							popup.dialog('close').remove();
						});
					});
				});

				$(this).append(node_html);

				$(this).droppable({
					drop: function(event, ui) {
						var target = self.flow.nodes[$(this).attr('id')],
							action,
							branch;

						if (ui.draggable.hasClass('action')) {
							action = ui.draggable.attr('name');

							branch = self.branch(action);
							branch.caption = self.actions[action].caption(branch, self.flow.caption_map);

							if (target.addChild(branch)) {
								if (branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {
									branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);

									self.actions[branch.parent.actionName].key_edit(branch, function() {
										self.actions[action].edit(branch, function() {
											self.repaintFlow();
										});
									});
								} else {
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

								if (branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {
									branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);
								}

								ui.draggable.remove();
								self.repaintFlow();
							}
						}
					}
				});

				// dragging the whole branch
				if ($(this).attr('name') !== 'root') {
					$(this).draggable({
						start: function() {
							var children = $(this).next(),
								top = children.offset().top - $(this).offset().top,
								left = children.offset().left - $(this).offset().left;

							self.enableDestinations($(this));

							$(this).attr('t', top); $(this).attr('l', left);
						},
						drag: function() {
							var children = $(this).next(),
								top = $(this).offset().top + parseInt($(this).attr('t')),
								left = $(this).offset().left + parseInt($(this).attr('l'));

							children.offset({ top: top, left: left });
						},
						stop: function() {
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
				flow = $(self.getTemplate({
					name: 'branch',
					data: {
						node: branch,
						display_key: branch.parent && ('key_caption' in self.actions[branch.parent.actionName])
					}
				})),
				children;

			if (branch.parent && ('key_edit' in self.actions[branch.parent.actionName])) {
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
				if ('category' in data && (!data.hasOwnProperty('isListed') || data.isListed)) {
					_.set(categories, data.category, _.get(categories, data.category, []));
					data.key = i;
					categories[data.category].push(data);
				}
			});

			$.each(categories, function(key, val) {
				if (key !== basic_cat && key !== advanced_cat) {
					dataTemplate.categories.push({ key: key, actions: val });
				}
			});

			dataTemplate.categories.sort(function(a, b) {
				return a.key < b.key ? 1 : -1;
			});

			dataTemplate.categories.unshift({
				key: basic_cat,
				actions: categories[basic_cat]
			}, {
				key: advanced_cat,
				actions: categories[advanced_cat]
			});

			$.each(categories, function(idx, val) {
				val.sort(function(a, b) {
					if (a.hasOwnProperty('weight')) {
						return a.weight > b.weight ? 1 : -1;
					}
				});
			});

			tools = $(self.getTemplate({
				name: 'tools',
				data: dataTemplate
			}));

			// Set the basic drawer to open
			$('#Basic', tools).removeClass('inactive').addClass('active');

			$('.category .open', tools).click(function() {
				tools
					.find('.category')
					.removeClass('active')
					.addClass('inactive');

				$(this)
					.parent('.category')
					.removeClass('inactive')
					.addClass('active');
			});

			var help_box = $('.callflow_helpbox_wrapper', '#callflow-view').first(),
				$allActions = tools.find('.tool');

			tools.find('.search-query').on('keyup', function() {
				// debounce executes a function after a delay if it hasn't been called again
				_.debounce(function(arg) {
					var $this = arg,
						val = $this.val().toLowerCase(),
						categories = [];

					if (val) {
						tools.find('.category').removeClass('active').addClass('inactive');

						$allActions.each(function() {
							var $thisAction = $(this);

							if ($thisAction.data('name').toLowerCase().indexOf(val) >= 0) {
								$thisAction.show();
								categories.push($thisAction.parents('.category').attr('id'));
							} else {
								$thisAction.hide();
							}
						});
					} else {
						tools.find('.category').removeClass('active').addClass('inactive');
						tools.find('.category').first().removeClass('inactive').addClass('active');
						tools.find('.tool').show();
					}

					categories = _.uniq(categories);
					_.each(categories, function(category) {
						tools.find('.category[name="' + category + '"]').addClass('active').removeClass('inactive');
					});
				}, 200)($(this));
			});

			$('.tool', tools).hover(
				function() {
					var $this = $(this);
					if ($this.attr('help')) {
						tools.find('.callflow_helpbox_wrapper #help_box').html($this.attr('help'));
						tools.find('.callflow_helpbox_wrapper').css('top', $this.offset().top).css('left', $('#ws_cf_tools').offset().left - 162).show();
					}
				},
				function() {
					tools.find('.callflow_helpbox_wrapper').hide();
				}
			);

			function action(el) {
				el.draggable({
					start: function() {
						self.enableDestinations($(this));
						$(this).addClass('inactive');
					},
					drag: function() {
						$('.callflow_helpbox_wrapper', '#callflow-view').hide();
					},
					stop: function() {
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

			$('.node').each(function() {
				var activate = true,
					target = self.flow.nodes[$(this).attr('id')];

				if (el.attr('name') in target.potentialChildren()) {
					if (el.hasClass('node') && self.flow.nodes[el.attr('id')].contains(target)) {
						activate = false;
					}
				} else {
					activate = false;
				}

				if (activate) {
					$(this).addClass('active');
				} else {
					$(this).addClass('inactive');
					$(this).droppable('disable');
				}
			});
		},

		disableDestinations: function() {
			$('.node').each(function() {
				$(this).removeClass('active');
				$(this).removeClass('inactive');
				$(this).droppable('enable');
			});

			$('.tool').removeClass('active');
		},

		save: function() {
			var self = this;

			if (self.flow.numbers && self.flow.numbers.length > 0) {
				var data_request = {
					numbers: self.flow.numbers,
					flow: (self.flow.root.children[0] === undefined) ? {} : self.flow.root.children[0].serialize()
				};

				if (self.flow.name !== '') {
					data_request.name = self.flow.name;
				} else {
					delete data_request.name;
					delete self.dataCallflow.name;
				}

				if ('contact_list' in self.flow) {
					data_request.contact_list = { exclude: self.flow.contact_list.exclude || false };
				}

				// We don't want to keep the old data from the flow, so we override it with what's on the current screen before the extend.
				self.dataCallflow.flow = data_request.flow;
				// Change dictated by the new field added by monster-ui. THis way we can potentially update callflows in Kazoo UI without breaking monster.
				data_request = $.extend(true, {}, self.dataCallflow, data_request);
				delete data_request.metadata;

				if (self.flow.id) {
					self.callApi({
						resource: 'callflow.update',
						data: {
							accountId: self.accountId,
							callflowId: self.flow.id,
							data: data_request
						},
						success: function(json) {
							self.repaintList();
							self.editCallflow({ id: json.data.id });
						}
					});
				} else {
					self.callApi({
						resource: 'callflow.create',
						data: {
							accountId: self.accountId,
							data: data_request
						},
						success: function(json) {
							self.repaintList();
							self.editCallflow({ id: json.data.id });
						}
					});
				}
			} else {
				monster.ui.alert(self.i18n.active().oldCallflows.you_need_to_select_a_number);
			}
		},

		winkstartTabs: function(template, advanced) {
			var buttons = template.find('.view-buttons'),
				tabs = template.find('.tabs');

			if (advanced) {
				buttons.find('.btn').removeClass('activate');
				buttons.find('.advanced').addClass('activate');
			} else {
				if (monster.config.advancedView) {
					buttons.find('.btn').removeClass('activate');
					buttons.find('.advanced').addClass('activate');
				} else {
					tabs.hide('blind');
				}
			}

			if (tabs.find('li').length < 2) {
				buttons.hide();
			}

			buttons.find('.basic').on('click', function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.find('li:first-child > a').trigger('click');
					tabs.hide('blind');
				}
			});

			buttons.find('.advanced').click(function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
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

				if (input_fields.size() > 1) {
					if (type === 'checkbox') {
						input_fields = input_fields.filter('[value=' + value + ']');
						(input.attr('checked')) ? input_fields.attr('checked', 'checked') : input_fields.removeAttr('checked');
					} else {
						$.each(input_fields, function(k, v) {
							var element = $(v);

							if (element.attr('id') !== id) {
								element.val(value);
							}
						});
					}
				} else {
					input.unbind('.link');
				}
			});
		},

		isDeviceCallable: function(device) {
			return _.every([
				device.enabled,
				device.registrable ? device.registered : true
			]);
		},

		/**
		 * Recursively unsets `obj`'s empty properties by mutating it
		 * @param  {Object} obj  Object to compact
		 */
		compactObject: function(obj) {
			var self = this;
			_.each(obj, function(value, key) {
				if (_.isPlainObject(value)) {
					self.compactObject(value);
				}
				if (_.isEmpty(value)) {
					_.unset(obj, key);
				}
			});
		}
	};

	return app;
});
