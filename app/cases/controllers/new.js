'use strict';
/*jshint camelcase: false*/
angular.module('RedhatAccess.cases').controller('New', [
    '$scope',
    '$state',
    '$q',
    '$timeout',
    'SearchResultsService',
    'AttachmentsService',
    'strataService',
    'RecommendationsService',
    'CaseService',
    'AlertService',
    'securityService',
    '$rootScope',
    'AUTH_EVENTS',
    '$location',
    'RHAUtils',
    'NEW_DEFAULTS',
    'NEW_CASE_CONFIG',
    '$http',
    function ($scope, $state, $q, $timeout, SearchResultsService, AttachmentsService, strataService, RecommendationsService, CaseService, AlertService, securityService, $rootScope, AUTH_EVENTS, $location, RHAUtils, NEW_DEFAULTS, NEW_CASE_CONFIG, $http) {
        $scope.NEW_CASE_CONFIG = NEW_CASE_CONFIG;
        $scope.versions = [];
        $scope.versionDisabled = true;
        $scope.versionLoading = false;
        $scope.incomplete = true;
        $scope.submitProgress = 0;
        AttachmentsService.clear();
        CaseService.clearCase();
        RecommendationsService.clear();
        SearchResultsService.clear();
        AlertService.clearAlerts();
        $scope.CaseService = CaseService;
        $scope.RecommendationsService = RecommendationsService;
        $scope.securityService = securityService;

        // Instantiate these variables outside the watch
        var waiting = false;
        $scope.$watch('CaseService.kase.description + CaseService.kase.summary', function () {
            if (!waiting){
                waiting = true;
                $timeout(function() {
                    waiting = false;
                    $scope.getRecommendations();
                }, 500); // delay 500 ms
            }
        });

        $scope.getRecommendations = function () {
            if ($scope.NEW_CASE_CONFIG.showRecommendations) {
                SearchResultsService.searchInProgress.value = true;
                var numRecommendations = 5;
                if($scope.NEW_CASE_CONFIG.isPCM){
                    numRecommendations = 30;
                }
                RecommendationsService.populateRecommendations(numRecommendations).then(function () {
                    SearchResultsService.clear();
                    RecommendationsService.recommendations.forEach(function (recommendation) {
                        SearchResultsService.add(recommendation);
                    });
                    SearchResultsService.searchInProgress.value = false;
                }, function (error) {
                    AlertService.addStrataErrorMessage(error);
                    SearchResultsService.searchInProgress.value = false;
                });
            }
        };
        CaseService.onOwnerSelectChanged = function () {
            if (CaseService.owner !== undefined) {
                CaseService.populateEntitlements(CaseService.owner);
                CaseService.populateGroups(CaseService.owner);
            }
            CaseService.validateNewCasePage1();
        };

        /**
        * Add the top sorted products to list
        */
        $scope.buildProductOptions = function(originalProductList) {
            var productOptions = [];
            var productSortList = [];
            if($scope.NEW_CASE_CONFIG.isPCM){
                $http.get($scope.NEW_CASE_CONFIG.productSortListFile).then(function (response) {
                    if (response.status === 200 && response.data !== undefined) {
                        productSortList = response.data.split(',');

                        angular.forEach(productSortList, function(sortProduct){
                            productOptions.push({
                                code: sortProduct,
                                name: sortProduct
                            });
                        }, this);

                        var sep = '────────────────────────────────────────';

                        productOptions.push({
                            isDisabled: true,
                            name: sep
                        });

                        angular.forEach(originalProductList, function(product){
                            productOptions.push({
                                code: product.code,
                                name: product.name
                            });
                        }, this);

                        $scope.products = productOptions;
                    } else {
                        angular.forEach(originalProductList, function(product){
                            productOptions.push({
                                code: product.code,
                                name: product.name
                            });
                        }, this);
                        $scope.products = productOptions;
                    }
                });
            } else {
                angular.forEach(originalProductList, function(product){
                    productOptions.push({
                        code: product.code,
                        name: product.name
                    });
                }, this);
                $scope.products = productOptions;
            }
        };

        /**
       * Populate the selects
       */
        $scope.initSelects = function () {
            CaseService.clearCase();
            $scope.productsLoading = true;
            strataService.products.list(securityService.loginStatus.authedUser.sso_username).then(function (products) {
                $scope.buildProductOptions(products);
                $scope.productsLoading = false;
                if (RHAUtils.isNotEmpty(NEW_DEFAULTS.product)) {
                    CaseService.kase.product = {
                        name: NEW_DEFAULTS.product,
                        code: NEW_DEFAULTS.product
                    };
                    $scope.getRecommendations();
                    $scope.getProductVersions(CaseService.kase.product);
                }
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
            });
            $scope.severitiesLoading = true;
            strataService.values.cases.severity().then(function (severities) {
                CaseService.severities = severities;
                CaseService.kase.severity = severities[severities.length - 1];
                $scope.severitiesLoading = false;
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
            });
            $scope.groupsLoading = true;
            CaseService.populateGroups().then(function (groups) {
                $scope.groupsLoading = false;
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
            });
        };
        $scope.initDescription = function () {
            var searchObject = $location.search();
            var setDesc = function (desc) {
                CaseService.kase.description = desc;
                $scope.getRecommendations();
            };
            if (searchObject.data) {
                setDesc(searchObject.data);
            } else {
                //angular does not  handle params before hashbang
                //@see https://github.com/angular/angular.js/issues/6172
                var queryParamsStr = window.location.search.substring(1);
                var parameters = queryParamsStr.split('&');
                for (var i = 0; i < parameters.length; i++) {
                    var parameterName = parameters[i].split('=');
                    if (parameterName[0] === 'data') {
                        setDesc(decodeURIComponent(parameterName[1]));
                    }
                }
            }
        };
        if (securityService.loginStatus.isLoggedIn) {
            $scope.initSelects();
            $scope.initDescription();
        }
        $scope.authLoginSuccess = $rootScope.$on(AUTH_EVENTS.loginSuccess, function () {
            $scope.initSelects();
            $scope.initDescription();
            AlertService.clearAlerts();
            RecommendationsService.failureCount = 0;
        });

        $scope.$on('$destroy', function () {
            $scope.authLoginSuccess();
        });
        /**
       * Retrieve product's versions from strata
       *
       * @param product
       */
        $scope.getProductVersions = function (product) {
            CaseService.kase.version = '';
            $scope.versionDisabled = true;
            $scope.versionLoading = true;
            strataService.products.versions(product.code).then(function (response) {
                $scope.versions = response;
                CaseService.validateNewCasePage1();
                $scope.versionDisabled = false;
                $scope.versionLoading = false;
                if (RHAUtils.isNotEmpty(NEW_DEFAULTS.version)) {
                    CaseService.kase.version = NEW_DEFAULTS.version;
                    $scope.getRecommendations();
                }
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
            });

            //Retrieve the product detail, basically finding the attachment artifact
            AttachmentsService.fetchProductDetail(product.code);
        };
        /**
       * Go to a page in the wizard
       *
       * @param page
       */
        $scope.gotoPage = function (page) {
            $scope.isPage1 = page === 1 ? true : false;
            $scope.isPage2 = page === 2 ? true : false;
        };
        /**
       * Navigate forward in the wizard
       */
        $scope.doNext = function () {
            $scope.gotoPage(2);
        };
        /**
       * Navigate back in the wizard
       */
        $scope.doPrevious = function () {
            $scope.gotoPage(1);
        };
        $scope.submittingCase = false;

        $scope.setSearchOptions = function (showsearchoptions) {
            CaseService.showsearchoptions = showsearchoptions;
            if(CaseService.groups.length === 0){
                CaseService.populateGroups().then(function (){
                    CaseService.buildGroupOptions();
                });
            } else{
                CaseService.buildGroupOptions();
            }
        };
        /**
       * Create the case with attachments
       */
        $scope.doSubmit = function ($event) {
            if (window.chrometwo_require !== undefined) {
                chrometwo_require(['analytics/main'], function (analytics) {
                    analytics.trigger('OpenSupportCaseSubmit', $event);
                });
            }
            /*jshint camelcase: false */
            var caseJSON = {
                    'product': CaseService.kase.product.code,
                    'version': CaseService.kase.version,
                    'summary': CaseService.kase.summary,
                    'description': CaseService.kase.description,
                    'severity': CaseService.kase.severity.name
                };
            if (RHAUtils.isNotEmpty(CaseService.group)) {
                caseJSON.folderNumber = CaseService.group;
            }
            if (RHAUtils.isNotEmpty(CaseService.entitlement)) {
                caseJSON.entitlement = {};
                caseJSON.entitlement.sla = CaseService.entitlement;
            }
            if (RHAUtils.isNotEmpty(CaseService.account)) {
                caseJSON.accountNumber = CaseService.account.number;
            }
            if (CaseService.fts) {
                caseJSON.fts = true;
                if (CaseService.fts_contact) {
                    caseJSON.contactInfo24X7 = CaseService.fts_contact;
                }
            }
            if (RHAUtils.isNotEmpty(CaseService.owner)) {
                caseJSON.contactSsoUsername = CaseService.owner;
            }
            $scope.submittingCase = true;
            AlertService.addWarningMessage('Creating case...');
            var redirectToCase = function (caseNumber) {
                $state.go('edit', { id: caseNumber });
                AlertService.clearAlerts();
                $scope.submittingCase = false;
            };
            strataService.cases.post(caseJSON).then(function (caseNumber) {
                AlertService.clearAlerts();
                AlertService.addSuccessMessage('Successfully created case number ' + caseNumber);
                if ((AttachmentsService.updatedAttachments.length > 0 || AttachmentsService.hasBackEndSelections()) && NEW_CASE_CONFIG.showAttachments) {
                    AttachmentsService.updateAttachments(caseNumber).then(function () {
                        redirectToCase(caseNumber);
                    }, function (error) {
                        AlertService.addStrataErrorMessage(error);
                        $scope.submittingCase = false;
                    });
                } else {
                    redirectToCase(caseNumber);
                }
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
                $scope.submittingCase = false;
            });
        };
        $scope.gotoPage(1);

        $scope.authEventLogoutSuccess = $rootScope.$on(AUTH_EVENTS.logoutSuccess, function () {
            CaseService.clearCase();
        });
        $scope.$on('$destroy', function () {
            CaseService.clearCase();
        });
    }
]);
