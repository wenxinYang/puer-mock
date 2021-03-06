var fs = require('fs');

var util = require('./util');
var mockRoute = require('mock-route');

var MOCK_JS_FILE = './_mockserver.js';
var MOCK_CONFIG_FILE = './_mockserver.json';
var mockConfigFileWatcher;

// @see https://github.com/ufologist/puer-mock/issues/10
delete Error.prepareStackTrace;

/**
 * 获取 puer mock route 的配置信息
 * 
 * @param mockJsFile {string} mock js file
 * @param mockConfigFile {string} mock server config file
 * @return mock route 的配置信息
 */
function puerMock(mockJsFile, mockConfigFile, renderApiDoc) {
    var _mockJsFile = mockJsFile || MOCK_JS_FILE;
    var _mockConfigFile = mockConfigFile || MOCK_CONFIG_FILE;

    // 监听接口配置文件(mockConfigFile)是否改动了, 改动后修改 mock 启动文件(mockJsFile)的修改时间,
    // 以激发 puer 本身的监听, 让其重新加载 mockJsFile, 则会重新加载 mockConfigFile,
    // 达到刷新 mockConfigFile 的目的
    //
    // XXX 如果在运行期间先修改 mockJsFile 再修改 mockConfigFile, 会造成无限循环重复监听(控制台被刷屏),
    // 因此最好不要在运行期间修改 mockJsFile
    // 
    // 我们这里先监听文件再读取 JSON, 以防止出现 JSON 读取异常(例如格式错误)造成程序不重新加载的问题
    mockConfigFileWatcher = util.watchFile(_mockConfigFile, function() {
        util.unwatchFile(mockConfigFileWatcher, _mockConfigFile);
        fs.utimes(_mockJsFile, new Date(), new Date(), function(error) {
            console.error(error);
        });
    });

    var mockConfig = mockRoute.getMockConfig(_mockConfigFile);
    var routeConfig = mockRoute.generateRouteConfig(mockConfig);
    var groupMockConfig = mockRoute.groupApiByModuleName(mockConfig);

    appendApidocRoute(routeConfig, renderApiDoc, groupMockConfig);

    return routeConfig;
}

/**
 * 列出所有的 mock API 作为一个接口文档
 */
function appendApidocRoute(routeConfig, renderApiDoc, groupMockConfig) {
    routeConfig['GET /_apidoc'] = function(request, response, next) {
        // /_apidoc 也做为一个接口来提供(使用 CORS 方式), 这样更加便于自定义 _apidoc 的 UI.
        // 完全支持自己写一套 UI 来获取解析 /_apidoc 提供的 JSON 数据来展现接口文档
        // 提供了默认的 example/_apidoc.html 做为默认的接口文档实现
        mockRoute.enableCors(request, response);

        if (renderApiDoc) {
            response.send(renderApiDoc(groupMockConfig));
        } else {
            response.jsonp(groupMockConfig);
        }
    };
}

module.exports = puerMock;