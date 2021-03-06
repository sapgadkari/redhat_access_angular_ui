'use strict';
/*global $ */
/*jshint expr: true, camelcase: false, newcap: false */
angular.module('RedhatAccess.cases').controller('DefaultGroup', [
    '$scope',
    '$rootScope',
    'strataService',
    'AlertService',
    '$location',
    'securityService',
    'AUTH_EVENTS',
    function ($scope, $rootScope, strataService, AlertService, $location, securityService, AUTH_EVENTS) {
        $scope.securityService = securityService;
        $scope.listEmpty = false;
        $scope.selectedGroup = {};
        $scope.selectedUser = '';
        $scope.usersOnAccount = [];
        $scope.account = null;
        $scope.groups = [];
        $scope.ssoName = null;
        $scope.groupsLoading = false;
        $scope.usersLoading = false;
        $scope.usersLoaded = false;
        $scope.usersAndGroupsFinishedLoading = false;
        
        $scope.init = function() {
            if(securityService.userAllowedToManageGroups()){
                $scope.groupsLoading = true;
                var loc = $location.url().split('/');
                $scope.ssoName = securityService.loginStatus.authedUser.sso_username;
                $scope.account = securityService.loginStatus.account;
                strataService.groups.list($scope.ssoName).then(function (groups) {
                    $scope.groupsLoading = false;
                    $scope.groups = groups;
                }, function (error) {
                    $scope.groupsLoading = false;
                    AlertService.addStrataErrorMessage(error);
                });

                $scope.usersLoading = true;
                strataService.accounts.users($scope.account.number, $scope.selectedGroup.number).then(function (users) {
                    $scope.usersLoading = false;
                    $scope.usersOnAccount = users;
                    $scope.usersLoaded = true;
                }, function (error) {
                    $scope.usersLoading = false;
                    AlertService.addStrataErrorMessage(error);
                });
            }else{
                $scope.usersLoading = false;
                $scope.groupsLoading = false;
                AlertService.addStrataErrorMessage('User does not have proper credentials to manage default groups.');
            }
        };

        $scope.userChange = function (){
            $scope.usersAndGroupsFinishedLoading = true;
        };

        $scope.setDefaultGroup = function () {
            //Remove old group is_default
            var tmpGroup = {
                name: $scope.selectedGroup.name,
                number: $scope.selectedGroup.number,
                isDefault: true,
                contactSsoName: $scope.selectedUser.sso_username
            };
            strataService.groups.createDefault(tmpGroup).then(function () {
                AlertService.addSuccessMessage('Successfully set ' + tmpGroup.name + ' as ' + $scope.selectedUser.sso_username + '\'s default group.');
            }, function (error) {
                AlertService.addStrataErrorMessage(error);
            });
        };

        $scope.back = function(){
            $location.path('/case/group');
        };

        if (securityService.loginStatus.isLoggedIn) {
            $scope.init();

        }
        $scope.authEventLogin = $rootScope.$on(AUTH_EVENTS.loginSuccess, function () {
            $scope.init();
        });

        $scope.authEventLogoutSuccess = $rootScope.$on(AUTH_EVENTS.logoutSuccess, function () {
            $scope.selectedGroup = {};
            $scope.usersOnScreen = [];
            $scope.usersOnAccount = [];
            $scope.accountNumber = null;
        });

        $scope.$on('$destroy', function () {
            $scope.authEventLogoutSuccess();
            $scope.authEventLogin();
        });
    }
]);