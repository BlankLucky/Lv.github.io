// 初始化地图
var map = new AMap.Map('container', {
    center: [87.617733, 43.792818],
    zoom: 10
});

// 存储当前地图上的所有标记
var currentMarkers = [];

// 设置自定义图标
var starIcon = new AMap.Icon({
    size: new AMap.Size(30, 30),
    image: 'data/star-icon.png',
    imageSize: new AMap.Size(30, 30)
});

// 从共享文件夹加载标注数据
function loadMarkers() {
    // 向主进程请求加载标注数据
    ipcRenderer.invoke('load-markers').then((markers) => {
        // 先清除地图上所有现有标记
        currentMarkers.forEach(marker => {
            map.remove(marker);
        });
        currentMarkers = [];

        markers.forEach(function(marker) {
            addMarkerToMap(marker.latitude, marker.longitude, marker.name, marker.description, marker.person, marker.image, marker.video, marker.id);
        });
    }).catch((err) => {
        console.error('加载标注数据失败', err);
    });
}

// 在地图上添加标注
function addMarkerToMap(lat, lng, name, description, person, image, video, markerId) {
    var position = [lng, lat];
    var marker = new AMap.Marker({
        position: position,
        map: map,
        title: name,
        icon: starIcon
    });

    var content = `
        <div style="max-width: 300px;">
            <strong>${name}</strong><br>
            <p>${description}</p>
            <p>标注人: ${person}</p>
            ${image ? `<img src="${image}" style="max-width: 100%;" />` : ''}
            ${video ? `<video style="max-width: 100%;" controls><source src="${video}" type="video/mp4">浏览器不支持视频播放</video>` : ''}
            <button onclick="deleteMarker('${markerId}')" style="margin-top: 10px; padding: 5px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">删除标注</button>
        </div>
    `;

    var infoWindow = new AMap.InfoWindow({
        content: content,
        offset: new AMap.Pixel(0, -30)
    });

    marker.on('click', function() {
        infoWindow.open(map, marker.getPosition());
    });

    // 保存到当前标记数组
    marker.markerId = markerId;
    currentMarkers.push(marker);
}

// 删除标注
function deleteMarker(markerId) {
    if (confirm("确定要删除此标注吗？")) {
        // 从地图上移除
        var markerToRemove = currentMarkers.find(m => m.markerId === markerId);
        if (markerToRemove) {
            map.remove(markerToRemove);
            currentMarkers = currentMarkers.filter(m => m.markerId !== markerId);
        }

        // 从共享文件夹删除
        ipcRenderer.invoke('delete-marker', markerId).then((message) => {
            console.log(message);
        }).catch((err) => {
            console.error('删除标注失败', err);
        });

        // 重新加载标注，确保删除后的标注不再出现
        loadMarkers();
    }
}

// 全局变量存储当前点击位置
var currentClickPosition = null;

// 点击地图添加新标注
AMap.event.addListener(map, 'click', function(e) {
    currentClickPosition = e.lnglat;

    // 显示表单
    var form = document.querySelector('.input-container-fixed');
    form.style.display = 'block';

    // 清空表单
    document.getElementById("markerName").value = '';
    document.getElementById("markerDescription").value = '';
    document.getElementById("message").style.display = 'none';
    document.getElementById("uploadMedia").value = '';
});

// 添加标注按钮点击事件
function addMarker() {
    if (!currentClickPosition) {
        alert("请先在地图上点击选择标注位置！");
        return;
    }

    var name = document.getElementById("markerName").value;
    var description = document.getElementById("markerDescription").value;
    var fileInput = document.getElementById("uploadMedia");

    if (!name || !description) {
        alert("标注人名称和描述是必填项！");
        return;
    }

    // 处理文件上传
    var image = null;
    var video = null;

    if (fileInput.files.length > 0) {
        var file = fileInput.files[0];
        if (file.type.startsWith('image/')) {
            image = URL.createObjectURL(file);
        } else if (file.type.startsWith('video/')) {
            video = URL.createObjectURL(file);
        }
    }

    // 创建新标注
    var markerId = 'marker_' + new Date().getTime();
    addMarkerToMap(currentClickPosition.lat, currentClickPosition.lng, name, description, name, image, video, markerId);

    // 创建标注数据
    var newMarker = {
        id: markerId,
        name: name,
        description: description,
        person: name,
        image: image,
        video: video,
        latitude: currentClickPosition.lat,
        longitude: currentClickPosition.lng,
        timestamp: new Date().toISOString()
    };

    // 保存到共享文件夹
    ipcRenderer.invoke('save-marker', newMarker).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error('保存标注数据失败', err);
    });

    // 显示成功消息
    document.getElementById("message").style.display = 'block';
    document.getElementById("message").textContent = '标注添加成功！';

    // 隐藏表单
    document.querySelector('.input-container-fixed').style.display = 'none';

    // 重置当前位置
    currentClickPosition = null;
}

// 下载标注数据
function downloadMarkers() {
    ipcRenderer.invoke('download-markers').then((markers) => {
        // 增强数据格式，包含更多信息
        var downloadData = {
            exportTime: new Date().toISOString(),
            totalMarkers: markers.length,
            markers: markers.map(marker => ({
                id: marker.id,
                name: marker.name,
                description: marker.description,
                person: marker.person,
                latitude: marker.latitude,
                longitude: marker.longitude,
                timestamp: marker.timestamp,
                hasImage: !!marker.image,
                hasVideo: !!marker.video
            }))
        };

        var blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '红色历史地图标注数据_' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
    }).catch((err) => {
        console.error('下载标注数据失败', err);
    });
}

// 页面加载时初始化
window.onload = function() {
    loadMarkers();  // 加载共享文件夹中的标注数据
};
