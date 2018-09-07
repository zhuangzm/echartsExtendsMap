/*
* echarts地图省市区下钻
*/
var extendsMap = function(options){
    this.container = document.getElementById(options.containerId);
    this.adname = options.adname ? options.adname : '全国';
    this.adcode = options.adcode ? options.adcode : 100000;
    this.breadcrumbData = [{adname: this.adname, adcode: this.adcode}];
    this.geoData = {'type': 'FeatureCollection','features': []};
    this.geoCoordMap = {};
    this.echartOption = options.echartOption;
    this.getAjaxData = options.getAjaxData;
    this.convertAjaxData = options.convertAjaxData;
    this.ajaxData = [];
    this.seriesData = [];
    this.echart;
    this.callback = options.callback;
    this.init();
}

extendsMap.prototype = {
    init: function(){
        var _this = this;
        if(!_this.echart) _this.initEchart();

        _this.echart.showLoading();

        // 注册地图
        _this.setJSONMap();
        setTimeout(function(){
            _this.createBreadcrumb();
            _this.createGeoCoordMap();
            _this.setAJaxData();
            _this.createSeriesData();
            _this.renderChart(); 
        }, 500);
        
        return _this;
    },

    initEchart: function(){
        var _this = this;
        _this.echart = echarts.init(_this.container);

        // _this.echart.on('georoam', function(d){
        //     _this.renderChart();
        // });

        _this.echart.on('click', function(params){
            var componentType = params.componentType;
            var childrenNum = 0;

            //根据目标类型获取adocde和下级区域数量
            if(componentType == 'geo') {
                var name = params.name;

                //通过名称从geoData获取数据
                var data = _this.geoData.features;
                for(var i = 0, len = data.length; i < len; i++){
                    var properties = data[i].properties;
                    if(properties.name == name){
                        childrenNum = properties.childrenNum;
                        _this.adcode = properties.adcode;
                        _this.adname = name;
                        break;
                    }
                }
            } else {
                childrenNum = params.data.childrenNum;
                _this.adcode = params.data.adcode;
                _this.adname = params.data.name;
            }


            if((childrenNum > 0 && _this.adcode) || _this.adcode == '710000' ) {
                _this.init();
            }else{
                console.log('无下级区域！');
            }
        })

    },

    renderChart: function(){
        var _this = this;
        var geo = _this.echartOption.geo;
        geo.map = _this.adname;

        switch(_this.adcode){
            case 100000://全国
                geo.zoom = 1.1;
                geo.center = [104.114129, 34.550339];
                break;
            case 460000://海南省
                geo.zoom = 5;
                geo.center = [110.33119, 19.031971];
                break;     
            default:
                geo.zoom = null;
                geo.center = null;
                break;
        }

        // var visualMapMax = 0;
        // for (var i=0;i<_this.seriesData.length;i++) {
        //     if (visualMapMax < _this.seriesData[i].value) {
        //         visualMapMax = _this.seriesData[i].value;
        //     }
        // }
        // // 最大值
        // _this.echartOption.visualMap.max = visualMapMax;
        
        // 地图
        _this.echartOption.series[0].data = _this.seriesData;
        _this.echartOption.series[1].data = _this.convertData(_this.seriesData);
        _this.echartOption.series[2].data = _this.convertData(_this.seriesData);

        _this.echart.hideLoading();
        _this.echart.clear();
        _this.echart.setOption(_this.echartOption);
        // 回调函数
        _this.callback(_this.adname, _this.adcode, _this.ajaxData);
    },

    convertData : function(data) {
        var _this = this;
        var res = [];
        for (var i = 0; i < data.length; i++) {
            var geoCoord = _this.geoCoordMap[data[i].name];
            if (geoCoord) {
                res.push({
                    name: data[i].name,
                    value: geoCoord.center.concat(data[i].value),
                    center: geoCoord.center,
                    adcode: geoCoord.adcode,
                    childrenNum: geoCoord.childrenNum
                });
            }
        }
        return res;
    },

    setJSONMap: function(){
        var _this = this;
        //遍历当前导航数据，获取地图路径
        if(_this.adcode){
            var url = './echarts/map/' + _this.adcode + '.json';
            $.get(url, function(geoJson){
                echarts.registerMap(_this.adname, geoJson);
                _this.geoData = echarts.getMap(_this.adname).geoJson;
            });
        } else {
            console.log('未找到地图文件！');
        }
    },

    setAJaxData: function() {
        var _this = this;
        _this.ajaxData = _this.getAjaxData(_this.adcode);
    },

    createSeriesData: function(){
        var _this = this;
        var data = _this.convertAjaxData(_this.ajaxData);

        var res = [];
        for (var i = 0; i < data.length; i++) {
            var geoCoord = _this.geoCoordMap[data[i].name];
            if (geoCoord) {
                res.push({
                    name: data[i].name,
                    value: data[i].value,
                    center: geoCoord.center,
                    adcode: geoCoord.adcode,
                    childrenNum: geoCoord.childrenNum
                });
            }
        }

        _this.seriesData = res;
    },

    createGeoCoordMap: function(){
        var _this = this;
        var features = _this.geoData.features;
        for(var i = 0, len = features.length; i < len; i++) {
            var properties = features[i].properties;
            var name = properties.name;
            var center = properties.centroid ? properties.centroid : properties.center;
            // 地区经纬度
            if (!_this.geoCoordMap[name]) {
                _this.geoCoordMap[name] = {
                    center: center,
                    adcode: properties.adcode,
                    childrenNum: properties.childrenNum
                };
            };
        }
    },

    /**
     * 创建地图导航
     * regionName 地图名
     **/
    createBreadcrumb: function(){
        var _this = this;
        //遍历当前导航数据，判断目标数据是否已存在，并重新构造数据
        var breadcrumbData = _this.breadcrumbData;
        var newBreadcrumbData = [];
        var isIn = false;
        for(var i = 0, len = breadcrumbData.length; i < len; i++){
            newBreadcrumbData.push(breadcrumbData[i]);
            if(breadcrumbData[i].adcode == _this.adcode) {
                isIn = true;
                break;
            }
        }
        if(isIn) {
            _this.breadcrumbData = newBreadcrumbData;
        }else{
            _this.breadcrumbData.push({adname: _this.adname, adcode: _this.adcode});
        }
        
        //根据最新导航数据，构造echart option
        var graphic = [];
        var concatString = '';
        breadcrumbData = _this.breadcrumbData;
        for(var j = 0, len = breadcrumbData.length; j < len; j++){
            breadcrumbData[j].concatString = concatString;
            graphic = graphic.concat(_this.createBreadcrumbOption(breadcrumbData[j], j));
            concatString = concatString + breadcrumbData[j].adname;
        }

        _this.echartOption.graphic = graphic;
    },
    
    createBreadcrumbOption: function(item, index){
        var _this = this;
        var style = {
            font: '18px "Microsoft YaHei", sans-serif',
            textColor: '#123456'
        };
        var pos = {
            leftCur: 150,
            top: 30,
            separationSpace: 15,
            separatorWidth: 7,
            wordWidth: 17,

        };

        //构造分隔符(>)polyline对象
        var line = [[0, 0], [pos.separatorWidth - 1, pos.separatorWidth], [0, pos.separatorWidth * 2]];
        var polylineLeft = pos.leftCur + (2 * index - 1) * pos.separationSpace + (item.concatString.length ) * pos.wordWidth + (index - 1) * pos.separatorWidth;
        var polyline = {
            type: 'polyline',
            left: polylineLeft,
            top: pos.top,
            shape: {
                points: line
            },
            silent: true,
            bounding: 'all'
        };

        //构造名称text对象
        var textLeft = pos.leftCur + index * (2 * pos.separationSpace + pos.separatorWidth) + item.concatString.length * pos.wordWidth;
        var text = {
            type: 'text',
            left: textLeft,
            top: pos.top,
            style: {
                text: item.adname,
                textAlign: 'center',
                fill: style.textColor,
                font: style.font
            },
            onclick: function(){
                if(item.adcode != _this.adcode){
                    _this.adcode = item.adcode;
                    _this.adname = item.adname;
                    _this.init();
                }
            }
        };

        return (index == 0 ? [text] : [polyline, text]);
    },

}
