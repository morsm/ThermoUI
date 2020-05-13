var ThermostatState = null;

function transferState()
{
    var stateJson = $("#stateObject").text();
    ThermostatState = JSON.parse(stateJson);

    // Trigger AJAX update
    scheduleUpdate();
}

function setNewState(state)
{
    ThermostatState = state;

    // Update UI
    $("#targetTemp").text(state.TargetTemperature.value.toFixed(1));
    $("#targetTempScale").text(state.TargetTemperature.scale.substring(0,1));

    $("#roomTemp").text(state.RoomTemperature.value.toFixed(1));
    $("#roomTempScale").text(state.RoomTemperature.scale.substring(0,1));

    $("#roomHum").text(state.RelativeHumidity);

    if (state.HeatingOn)
    {
        $("#heatingOn").removeClass("invisible");
        $("#heatingOn").addClass("visible");
    }
    else
    {
        $("#heatingOn").removeClass("visible");
        $("#heatingOn").addClass("invisible");
    }
}

function showStatus(message)
{
    // TODO: status label
    alert(message);
}

function changeTemperature(delta)
{
    ThermostatState.TargetTemperature.value += delta;

    $.ajax({
        url: "post_temp",
        type: "POST",
        data: JSON.stringify(ThermostatState.TargetTemperature),
        contentType: "application/json",
        dataType: "json"
    })
    .done(function(json) {

        setNewState(json);

    })
    .fail(function(xhr, status, errorThrown) {
        showStatus("There was a problem setting the temperature");
    });
}

function scheduleUpdate()
{
    $.ajax({
        url: "ajax_update",
        type: "POST",
        data: JSON.stringify(ThermostatState),
        contentType: "application/json",
        dataType: "json",
        timeout: 60000
    })
    .done(function(json) {

        setNewState(json);
        scheduleUpdate();
    })
    .fail(function(xhr, status, errorThrown) {
        scheduleUpdate();
    });
}