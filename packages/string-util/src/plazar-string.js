﻿return {
    camelize: function (str) {
        return pz.camelize(str);
    },

    capitalize: function (str) {
        if (pz.isEmpty(str)) {
            return '';
        };

        var result = str.charAt(0).toUpperCase() + str.substr(1);
        return result || '';
    },

    contains: function (str, value) {
        return pz.isEmpty(str) || pz.isEmpty(value) ? false :
            str.indexOf(value) != -1;
    },

    format: function() {
        return pz.format.apply(pz, arguments);
    }
};